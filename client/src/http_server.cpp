#include "../include/http_server.hpp"
#include "../include/logger.hpp"
#include <iostream>
#include <sstream>
#include <thread>
#include <cstring>
#include <algorithm>

#ifdef _WIN32
#include <wincrypt.h>
#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "advapi32.lib")
#endif

namespace webrpc {

static void sha1(const uint8_t* data, size_t len, uint8_t out[20]) {
#ifdef _WIN32
    HCRYPTPROV prov = 0;
    HCRYPTHASH hash = 0;
    CryptAcquireContextA(&prov, NULL, NULL, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT);
    CryptCreateHash(prov, CALG_SHA1, 0, 0, &hash);
    CryptHashData(hash, data, (DWORD)len, 0);
    DWORD hashLen = 20;
    CryptGetHashParam(hash, HP_HASHVAL, out, &hashLen, 0);
    CryptDestroyHash(hash);
    CryptReleaseContext(prov, 0);
#endif
}

static std::string base64Encode(const uint8_t* data, size_t len) {
    static const char t[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string r;
    r.reserve(((len + 2) / 3) * 4);
    for (size_t i = 0; i < len; i += 3) {
        uint32_t n = ((uint32_t)data[i]) << 16;
        if (i + 1 < len) n |= ((uint32_t)data[i + 1]) << 8;
        if (i + 2 < len) n |= data[i + 2];
        r += t[(n >> 18) & 0x3F];
        r += t[(n >> 12) & 0x3F];
        r += (i + 1 < len) ? t[(n >> 6) & 0x3F] : '=';
        r += (i + 2 < len) ? t[n & 0x3F] : '=';
    }
    return r;
}

HttpServer::HttpServer(int port) 
    : port_(port), running_(false), serverSocket_(INVALID_SOCKET) {
#ifdef _WIN32
    if (WSAStartup(MAKEWORD(2, 2), &wsaData_) != 0) {
        Log::err("WSAStartup failed");
    }
#endif
}

HttpServer::~HttpServer() {
    stop();
#ifdef _WIN32
    WSACleanup();
#endif
}

bool HttpServer::start() {
#ifdef _WIN32
    serverSocket_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket_ == INVALID_SOCKET) {
        Log::err("Failed to create socket");
        return false;
    }
#else
    serverSocket_ = socket(AF_INET, SOCK_STREAM, 0);
    if (serverSocket_ < 0) {
        Log::err("Failed to create socket");
        return false;
    }
#endif

    int opt = 1;
#ifdef _WIN32
    setsockopt(serverSocket_, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
    setsockopt(serverSocket_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(port_);

    if (bind(serverSocket_, (sockaddr*)&serverAddr, sizeof(serverAddr)) < 0) {
        Log::err("Failed to bind to port " + std::to_string(port_));
#ifdef _WIN32
        closesocket(serverSocket_);
#else
        close(serverSocket_);
#endif
        return false;
    }

    if (listen(serverSocket_, 5) < 0) {
        Log::err("Failed to listen");
#ifdef _WIN32
        closesocket(serverSocket_);
#else
        close(serverSocket_);
#endif
        return false;
    }

    running_ = true;
    std::thread(&HttpServer::acceptConnection, this).detach();
    return true;
}

void HttpServer::stop() {
    running_ = false;
#ifdef _WIN32
    if (serverSocket_ != INVALID_SOCKET) {
        closesocket(serverSocket_);
        serverSocket_ = INVALID_SOCKET;
    }
#else
    if (serverSocket_ >= 0) {
        close(serverSocket_);
        serverSocket_ = -1;
    }
#endif
}

void HttpServer::setRequestHandler(const std::string& path, RequestHandler handler) {
    handlers_[path] = handler;
}

void HttpServer::setWebSocketHandler(WsHandler handler) {
    wsHandler_ = handler;
}

void HttpServer::broadcastWS(const std::string& message) {
    std::lock_guard<std::mutex> lock(wsMutex_);
    for (auto it = wsClients_.begin(); it != wsClients_.end(); ) {
        try {
            sendWsFrame(*it, message);
            ++it;
        } catch (...) {
            closesocket(*it);
            it = wsClients_.erase(it);
        }
    }
}

void HttpServer::acceptConnection() {
    while (running_) {
        sockaddr_in clientAddr;
        int clientAddrLen = sizeof(clientAddr);
        SOCKET clientSocket = accept(serverSocket_, (sockaddr*)&clientAddr, &clientAddrLen);
        if (clientSocket == INVALID_SOCKET) continue;
        std::thread(&HttpServer::handleClient, this, clientSocket).detach();
    }
}

void HttpServer::handleClient(SOCKET clientSocket) {
    std::string requestStr;
    char buffer[8192];
    int totalRead = 0;
    
    while (true) {
        int bytesRead = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
        if (bytesRead <= 0) break;
        buffer[bytesRead] = '\0';
        requestStr.append(buffer, bytesRead);
        totalRead += bytesRead;
        
        size_t headerEnd = requestStr.find("\r\n\r\n");
        if (headerEnd != std::string::npos) {
            
            if (isWebSocketUpgrade(requestStr)) {
                handleWebSocket(clientSocket, requestStr);
                return; 
            }
            size_t clPos = requestStr.find("Content-Length:");
            if (clPos != std::string::npos && clPos < headerEnd) {
                size_t valStart = clPos + 15;
                while (valStart < requestStr.length() && requestStr[valStart] == ' ') valStart++;
                size_t valEnd = requestStr.find("\r\n", valStart);
                int contentLength = std::stoi(requestStr.substr(valStart, valEnd - valStart));
                size_t bodyStart = headerEnd + 4;
                int bodyReceived = static_cast<int>(requestStr.length() - bodyStart);
                if (bodyReceived >= contentLength) break;
            } else {
                break;
            }
        }
        if (totalRead > 1048576) break;
    }
    
    if (!requestStr.empty()) {
        try {
            HttpRequest request = parseRequest(requestStr);
            HttpResponse response(404, R"({"error":"Not found"})");
            
            if (request.method == "OPTIONS") {
                response = HttpResponse(200, "");
            } else {
                auto it = handlers_.find(request.path);
                if (it != handlers_.end()) {
                    response = it->second(request);
                } else {
                    Log::warn("No handler: " + request.path);
                }
            }
            
            if (request.path != "/health") {
                Log::request(request.method, request.path, response.statusCode);
            }
            
            std::string responseStr = buildResponse(response);
            send(clientSocket, responseStr.c_str(), (int)responseStr.length(), 0);
        } catch (const std::exception& e) {
            Log::err("Request error: " + std::string(e.what()));
        }
    }
    
    closesocket(clientSocket);
}

bool HttpServer::isWebSocketUpgrade(const std::string& headers) {
    size_t checkLen = headers.size() < 2048 ? headers.size() : 2048;
    std::string lower = headers.substr(0, checkLen);
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    return lower.find("upgrade: websocket") != std::string::npos;
}

std::string HttpServer::computeWsAcceptKey(const std::string& clientKey) {
    std::string concat = clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    uint8_t hash[20];
    sha1((const uint8_t*)concat.data(), concat.size(), hash);
    return base64Encode(hash, 20);
}

void HttpServer::handleWebSocket(SOCKET clientSocket, const std::string& headers) {
    
    std::string key;
    size_t keyPos = headers.find("Sec-WebSocket-Key:");
    if (keyPos == std::string::npos) keyPos = headers.find("sec-websocket-key:");
    if (keyPos != std::string::npos) {
        size_t start = keyPos + 18;
        while (start < headers.size() && headers[start] == ' ') start++;
        size_t end = headers.find("\r\n", start);
        key = headers.substr(start, end - start);
    }
    
    if (key.empty()) {
        closesocket(clientSocket);
        return;
    }
    
    std::string accept = computeWsAcceptKey(key);
    std::string resp = "HTTP/1.1 101 Switching Protocols\r\n"
                       "Upgrade: websocket\r\n"
                       "Connection: Upgrade\r\n"
                       "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
    send(clientSocket, resp.c_str(), (int)resp.size(), 0);
    
    Log::ok("WebSocket client connected");
    if (wsConnectHandler_) {
        wsConnectHandler_();
    }
    
    {
        std::lock_guard<std::mutex> lock(wsMutex_);
        wsClients_.push_back(clientSocket);
    }
    
    while (running_) {
        bool closed = false;
        std::string msg = readWsFrame(clientSocket, closed);
        if (closed) break;
        if (!msg.empty() && wsHandler_) {
            wsHandler_(msg);
        }
    }
    
    {
        std::lock_guard<std::mutex> lock(wsMutex_);
        wsClients_.erase(std::remove(wsClients_.begin(), wsClients_.end(), clientSocket), wsClients_.end());
    }
    
    closesocket(clientSocket);
    Log::info("WebSocket client disconnected");
}

void HttpServer::sendWsFrame(SOCKET sock, const std::string& data) {
    std::vector<uint8_t> frame;
    frame.push_back(0x81); 
    
    if (data.size() <= 125) {
        frame.push_back((uint8_t)data.size());
    } else if (data.size() <= 65535) {
        frame.push_back(126);
        frame.push_back((uint8_t)(data.size() >> 8));
        frame.push_back((uint8_t)(data.size() & 0xFF));
    } else {
        frame.push_back(127);
        for (int i = 7; i >= 0; --i)
            frame.push_back((uint8_t)(data.size() >> (8 * i)));
    }
    
    frame.insert(frame.end(), data.begin(), data.end());
    send(sock, (const char*)frame.data(), (int)frame.size(), 0);
}

std::string HttpServer::readWsFrame(SOCKET sock, bool& closed) {
    closed = false;
    uint8_t header[2];
    int r = recv(sock, (char*)header, 2, 0);
    if (r <= 0) { closed = true; return ""; }
    
    uint8_t opcode = header[0] & 0x0F;
    bool masked = (header[1] & 0x80) != 0;
    uint64_t payloadLen = header[1] & 0x7F;
    
    if (opcode == 0x8) { closed = true; return ""; } 
    if (opcode == 0x9) { 
        uint8_t pong[2] = {0x8A, 0x00};
        send(sock, (char*)pong, 2, 0);
        return "";
    }
    
    if (payloadLen == 126) {
        uint8_t ext[2];
        recv(sock, (char*)ext, 2, 0);
        payloadLen = ((uint64_t)ext[0] << 8) | ext[1];
    } else if (payloadLen == 127) {
        uint8_t ext[8];
        recv(sock, (char*)ext, 8, 0);
        payloadLen = 0;
        for (int i = 0; i < 8; ++i) payloadLen = (payloadLen << 8) | ext[i];
    }
    
    uint8_t mask[4] = {};
    if (masked) recv(sock, (char*)mask, 4, 0);
    
    if (payloadLen > 1048576) { closed = true; return ""; }
    
    std::string data(payloadLen, '\0');
    size_t received = 0;
    while (received < payloadLen) {
        r = recv(sock, &data[received], (int)(payloadLen - received), 0);
        if (r <= 0) { closed = true; return ""; }
        received += r;
    }
    
    if (masked) {
        for (size_t i = 0; i < data.size(); ++i)
            data[i] ^= mask[i % 4];
    }
    
    return data;
}

HttpRequest HttpServer::parseRequest(const std::string& requestStr) {
    HttpRequest request;
    
    std::istringstream iss(requestStr);
    std::string line;
    
    if (std::getline(iss, line)) {
        size_t firstSpace = line.find(' ');
        size_t secondSpace = line.find(' ', firstSpace + 1);
        
        if (firstSpace != std::string::npos && secondSpace != std::string::npos) {
            request.method = line.substr(0, firstSpace);
            request.path = line.substr(firstSpace + 1, secondSpace - firstSpace - 1);
        }
    }
    
    while (std::getline(iss, line) && line != "\r") {
        if (line.find("Content-Type:") == 0) {
            request.contentType = line.substr(13);
            
            if (!request.contentType.empty() && request.contentType.back() == '\r') {
                request.contentType.pop_back();
            }
        }
        
        if (line.find("Content-Length:") == 0) {
            
        }
    }
    
    std::string body;
    while (std::getline(iss, line)) {
        body += line + "\n";
    }
    if (!body.empty() && body.back() == '\n') {
        body.pop_back();
    }
    request.body = body;
    
    return request;
}

std::string HttpServer::buildResponse(const HttpResponse& response) {
    std::ostringstream oss;
    oss << "HTTP/1.1 " << response.statusCode << " ";
    
    switch (response.statusCode) {
        case 200: oss << "OK"; break;
        case 400: oss << "Bad Request"; break;
        case 404: oss << "Not Found"; break;
        case 405: oss << "Method Not Allowed"; break;
        case 500: oss << "Internal Server Error"; break;
        default: oss << "Unknown"; break;
    }
    
    oss << "\r\n";
    oss << "Content-Type: " << response.contentType << "\r\n";
    oss << "Content-Length: " << response.body.length() << "\r\n";
    oss << "Access-Control-Allow-Origin: *\r\n";
    oss << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
    oss << "Access-Control-Allow-Headers: Content-Type\r\n";
    oss << "\r\n";
    oss << response.body;
    
    return oss.str();
}

} 
