#pragma once

#include <string>
#include <functional>
#include <memory>
#include <vector>
#include <mutex>

#ifdef _WIN32
    #include <winsock2.h>
    #include <windows.h>
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>
    #include <arpa/inet.h>
#endif

namespace webrpc {

struct HttpRequest {
    std::string method;
    std::string path;
    std::string body;
    std::string contentType;
    std::string headers;
};

struct HttpResponse {
    int statusCode;
    std::string body;
    std::string contentType;
    
    HttpResponse(int code = 200, const std::string& b = "", const std::string& ct = "application/json")
        : statusCode(code), body(b), contentType(ct) {}
};

class HttpServer {
public:
    using RequestHandler = std::function<HttpResponse(const HttpRequest&)>;
    using WsHandler = std::function<void(const std::string&)>;
    using WsConnectHandler = std::function<void()>;
    
    HttpServer(int port = 8765);
    ~HttpServer();
    
    bool start();
    void stop();
    void setRequestHandler(const std::string& path, RequestHandler handler);
    void setWebSocketHandler(WsHandler handler);
    void setWebSocketConnectHandler(WsConnectHandler handler) { wsConnectHandler_ = handler; }
    void broadcastWS(const std::string& message);
    
    bool isRunning() const { return running_; }
    int getPort() const { return port_; }
    void setPort(int port) { port_ = port; }
    
private:
    int port_;
    bool running_;
    
#ifdef _WIN32
    SOCKET serverSocket_;
    WSADATA wsaData_;
#else
    int serverSocket_;
#endif
    
    std::unordered_map<std::string, RequestHandler> handlers_;
    WsHandler wsHandler_;
    WsConnectHandler wsConnectHandler_;
    
    std::mutex wsMutex_;
    std::vector<SOCKET> wsClients_;
    
    void acceptConnection();
    HttpRequest parseRequest(const std::string& requestStr);
    std::string buildResponse(const HttpResponse& response);
    void handleClient(SOCKET clientSocket);
    
    bool isWebSocketUpgrade(const std::string& headers);
    void handleWebSocket(SOCKET clientSocket, const std::string& headers);
    std::string computeWsAcceptKey(const std::string& clientKey);
    void sendWsFrame(SOCKET sock, const std::string& data);
    std::string readWsFrame(SOCKET sock, bool& closed);
};

} 
