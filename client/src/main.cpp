#include "../include/http_server.hpp"
#include "../include/discord_manager.hpp"
#include "../include/activity_handler.hpp"
#include "../include/json_handler.hpp"
#include "../include/logger.hpp"
#include <iostream>
#include <memory>
#include <thread>
#include <chrono>
#include <atomic>
#include <csignal>

#ifdef _WIN32
#include "../include/tray_manager.hpp"
#include "../include/console_menu.hpp"
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#endif

using namespace webrpc;

static std::atomic<bool> g_running{true};
static std::atomic<bool> g_discordConnected{false};

void signalHandler(int) {
    g_running = false;
}

#ifdef _WIN32

BOOL WINAPI consoleCtrlHandler(DWORD event) {
    if (event == CTRL_CLOSE_EVENT) {
        
        ShowWindow(GetConsoleWindow(), SW_HIDE);
        return TRUE;  
    }
    if (event == CTRL_C_EVENT || event == CTRL_BREAK_EVENT) {
        g_running = false;
        return TRUE;
    }
    return FALSE;
}
#endif

#ifdef _WIN32
#include <wininet.h>
#pragma comment(lib, "wininet.lib")

#include "../include/version.hpp"

static ConsoleMenu* g_menuPtr = nullptr;

bool downloadFileWithProgress(const std::string& url, const std::string& destPath, std::function<void(size_t downloaded, size_t total)> progressFn) {
    HINTERNET hNet = InternetOpenA("WebRPC-Downloader", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    if (!hNet) return false;
    HINTERNET hUrl = InternetOpenUrlA(hNet, url.c_str(), NULL, 0, INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
    if (!hUrl) {
        InternetCloseHandle(hNet);
        return false;
    }

    size_t totalBytes = 0;
    char lenBuf[64] = {0};
    DWORD lenBufSize = sizeof(lenBuf);
    if (HttpQueryInfoA(hUrl, HTTP_QUERY_CONTENT_LENGTH, lenBuf, &lenBufSize, NULL)) {
        totalBytes = (size_t)std::stoull(lenBuf);
    }

    FILE* fp = fopen(destPath.c_str(), "wb");
    if (!fp) {
        InternetCloseHandle(hUrl);
        InternetCloseHandle(hNet);
        return false;
    }

    char buffer[8192];
    DWORD bytesRead = 0;
    size_t downloadedBytes = 0;

    while (InternetReadFile(hUrl, buffer, sizeof(buffer), &bytesRead) && bytesRead > 0) {
        fwrite(buffer, 1, bytesRead, fp);
        downloadedBytes += bytesRead;
        if (progressFn) progressFn(downloadedBytes, totalBytes);
    }

    fclose(fp);
    InternetCloseHandle(hUrl);
    InternetCloseHandle(hNet);
    return downloadedBytes > 0;
}

void performAutoUpdate(const std::string& downloadUrl) {
    std::thread([downloadUrl]() {
        char tempPath[MAX_PATH] = {0};
        GetTempPathA(MAX_PATH, tempPath);
        std::string newExePath = std::string(tempPath) + "webRPC_update.exe";
        
        char currentExePath[MAX_PATH] = {0};
        GetModuleFileNameA(NULL, currentExePath, MAX_PATH);
        DWORD currentPid = GetCurrentProcessId();

        Log::ok("Downloading update from " + downloadUrl + "...");

        bool ok = downloadFileWithProgress(downloadUrl, newExePath, [](size_t downloaded, size_t total) {
            if (g_menuPtr) {
                g_menuPtr->updateProgress(downloaded, total);
            }
        });

        if (ok) {
            Log::ok("Download complete! Launching updater and restarting...");
            std::string cmdArgs = "--install-update \"" + std::string(currentExePath) + "\" " + std::to_string(currentPid);
            ShellExecuteA(NULL, "open", newExePath.c_str(), cmdArgs.c_str(), NULL, SW_SHOWNORMAL);
            exit(0);
        } else {
            Log::err("Failed to download update file!");
            ShellExecuteA(NULL, "open", "https://github.com/ewinnery/webRPC/releases/tag/v2", NULL, NULL, SW_SHOWNORMAL);
        }
    }).detach();
}

void postponeUpdate(const std::string& postponeFile) {
    long long now = std::chrono::duration_cast<std::chrono::seconds>(std::chrono::system_clock::now().time_since_epoch()).count();
    FILE* pfp = fopen(postponeFile.c_str(), "wb");
    if (pfp) {
        fprintf(pfp, "%lld", now);
        fclose(pfp);
    }
    Log::info("Update postponed for 24 hours.");
}

void checkForUpdatesAsync() {
    std::thread([]() {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        
        char tempPath[MAX_PATH] = {0};
        GetTempPathA(MAX_PATH, tempPath);
        std::string postponeFile = std::string(tempPath) + "webrpc_postpone.tmp";
        FILE* fp = fopen(postponeFile.c_str(), "rb");
        if (fp) {
            long long lastPostponed = 0;
            if (fscanf(fp, "%lld", &lastPostponed) == 1) {
                long long now = std::chrono::duration_cast<std::chrono::seconds>(std::chrono::system_clock::now().time_since_epoch()).count();
                if (now - lastPostponed < 86400) {
                    fclose(fp);
                    return;
                }
            }
            fclose(fp);
        }

        HINTERNET hNet = InternetOpenA("WebRPC-UpdateChecker", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
        if (!hNet) return;
        
        HINTERNET hUrl = InternetOpenUrlA(hNet, "https://raw.githubusercontent.com/ewinnery/webRPC/main/version.json", NULL, 0, INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
        if (hUrl) {
            char buffer[2048] = {0};
            DWORD bytesRead = 0;
            if (InternetReadFile(hUrl, buffer, sizeof(buffer) - 1, &bytesRead) && bytesRead > 0) {
                std::string jsonStr(buffer, bytesRead);
                size_t vPos = jsonStr.find("\"version\":");
                if (vPos != std::string::npos) {
                    size_t q1 = jsonStr.find('"', vPos + 10);
                    size_t q2 = jsonStr.find('"', q1 + 1);
                    if (q1 != std::string::npos && q2 != std::string::npos) {
                        std::string remoteVer = jsonStr.substr(q1 + 1, q2 - q1 - 1);
                        std::string currentVer = WEBRPC_VERSION; // Shared version constant (currently 1.0.0 for test trigger)
                        if (!remoteVer.empty() && remoteVer != currentVer) {
                            Log::ok("========================================");
                            Log::ok("NEW WEBRPC UPDATE AVAILABLE: " + remoteVer);
                            Log::ok("========================================");
                            
                            std::string exeUrl = "https://github.com/ewinnery/webRPC/releases/download/v2/webRPC.exe";
                            size_t exePos = jsonStr.find("\"exe_download_url\":");
                            if (exePos != std::string::npos) {
                                size_t eq1 = jsonStr.find('"', exePos + 19);
                                size_t eq2 = jsonStr.find('"', eq1 + 1);
                                if (eq1 != std::string::npos && eq2 != std::string::npos) {
                                    exeUrl = jsonStr.substr(eq1 + 1, eq2 - eq1 - 1);
                                }
                            }
                            
                            std::string releaseUrl = "https://github.com/ewinnery/webRPC/releases/tag/v2";
                            
                            if (g_menuPtr) {
                                g_menuPtr->triggerUpdateView(remoteVer, exeUrl, releaseUrl,
                                    [exeUrl]() { performAutoUpdate(exeUrl); },
                                    [postponeFile]() { postponeUpdate(postponeFile); });
                            }
                        }
                    }
                }
            }
            InternetCloseHandle(hUrl);
        }
        InternetCloseHandle(hNet);
    }).detach();
}
#endif

int main(int argc, char* argv[]) {
    if (argc >= 3 && std::string(argv[1]) == "--install-update") {
        std::string targetPath = argv[2];
        DWORD oldPid = argc >= 4 ? (DWORD)std::stoul(argv[3]) : 0;
        
        if (oldPid > 0) {
            HANDLE hProc = OpenProcess(SYNCHRONIZE | PROCESS_TERMINATE, FALSE, oldPid);
            if (hProc) {
                WaitForSingleObject(hProc, 4000);
                CloseHandle(hProc);
            }
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
        
        char selfPath[MAX_PATH] = {0};
        GetModuleFileNameA(NULL, selfPath, MAX_PATH);
        
        BOOL ok = CopyFileA(selfPath, targetPath.c_str(), FALSE);
        if (!ok) {
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
            CopyFileA(selfPath, targetPath.c_str(), FALSE);
        }
        
        ShellExecuteA(NULL, "open", targetPath.c_str(), NULL, NULL, SW_SHOWNORMAL);
        return 0;
    }

    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);
    
    bool startMinimized = false;
    for (int i = 1; i < argc; ++i) {
        if (std::string(argv[i]) == "--minimized") {
            startMinimized = true;
        }
    }
    
#ifdef _WIN32
    SetConsoleCtrlHandler(consoleCtrlHandler, TRUE);
    if (startMinimized) {
        ShowWindow(GetConsoleWindow(), SW_HIDE);
    }
    checkForUpdatesAsync();
#endif
    
    Log::init();
    Log::banner();
    
    auto discordManager = std::make_shared<DiscordManager>();
    if (!discordManager->initialize()) {
        Log::warn("Discord RPC not available - HTTP-only mode");
    } else {
        Log::ok("Discord RPC initialized");
        g_discordConnected = true;
    }
    
    auto activityHandler = std::make_shared<ActivityHandler>(discordManager);
    
    HttpServer server(8765);
    
    auto extensionConnected = std::make_shared<std::atomic<bool>>(false);
    
    server.setRequestHandler("/health", [extensionConnected](const HttpRequest& req) -> HttpResponse {
        if (!extensionConnected->load()) {
            extensionConnected->store(true);
            Log::ok("Extension connected!");
        }
        return HttpResponse(200, R"({"status":"ok","service":"webrpc-client"})");
    });
    
    server.setRequestHandler("/webrpc", [activityHandler, extensionConnected](const HttpRequest& req) -> HttpResponse {
        if (req.method != "POST") {
            return HttpResponse(405, R"({"error":"Method not allowed"})");
        }
        
        if (!extensionConnected->load()) {
            extensionConnected->store(true);
            Log::ok("Extension connected!");
        }
        
        Log::debug("Body: " + (req.body.size() > 200 ? req.body.substr(0, 200) + "..." : req.body));
        
        try {
            auto data = JsonHandler::parse(req.body);
            std::string type = JsonHandler::getString(data, "type");
            
            if (type == "ping") {
                return HttpResponse(200, R"({"pong":true})");
            }
            if (type == "clearActivity") {
                activityHandler->handleClearActivity();
            } else {
                activityHandler->handleSetActivity(req.body);
            }
            return HttpResponse(200, R"({"success":true})");
        } catch (const std::exception& e) {
            Log::err(std::string("Request error: ") + e.what());
            return HttpResponse(500, std::string(R"({"error":")") + e.what() + R"("})");
        }
    });
    
    server.setWebSocketConnectHandler([extensionConnected]() {
        if (!extensionConnected->load()) {
            extensionConnected->store(true);
            Log::ok("Extension connected via WebSocket!");
        }
    });

    server.setWebSocketHandler([activityHandler, extensionConnected](const std::string& msg) {
        if (!extensionConnected->load()) {
            extensionConnected->store(true);
            Log::ok("Extension connected via WebSocket!");
        }
        Log::debug("WS: " + (msg.size() > 200 ? msg.substr(0, 200) + "..." : msg));
        try {
            auto data = JsonHandler::parse(msg);
            std::string type = JsonHandler::getString(data, "type");
            if (type == "ping") return;
            if (type == "clearActivity") {
                activityHandler->handleClearActivity();
            } else {
                activityHandler->handleSetActivity(msg);
            }
        } catch (const std::exception& e) {
            Log::err(std::string("WS parse error: ") + e.what());
        }
    });
    
    if (!server.start()) {
        Log::err("Failed to start HTTP server on port 8765");
        discordManager->shutdown();
        return 1;
    }
    
    Log::ok("HTTP server listening on port 8765 (HTTP + WebSocket)");
    Log::info("Waiting for browser extension...");

#ifdef _WIN32
    
    TrayManager tray;
    tray.initialize("WebRPC - Running");
    
    auto reconnectFn = [&discordManager]() {
        Log::info("Reconnecting Discord RPC...");
        discordManager->shutdown();
        g_discordConnected = false;
        if (discordManager->initialize()) {
            Log::ok("Discord RPC reconnected");
            g_discordConnected = true;
        } else {
            Log::err("Failed to reconnect Discord RPC");
        }
    };
    
    auto exitFn = [&]() {
        g_running = false;
    };
    
    tray.onReconnect = reconnectFn;
    tray.onExit = exitFn;
    tray.showBalloon("WebRPC", "Client is running in the background");
    
    ConsoleMenu menu;
    g_menuPtr = &menu;
    
    menu.setStatusLine([&, extensionConnected]() -> std::string {
        std::string s = "Discord: ";
        s += g_discordConnected ? "OK" : "OFF";
        s += "  |  Ext: ";
        s += extensionConnected->load() ? "OK" : "...";
        s += "  |  Port: " + std::to_string(server.getPort());
        return s;
    });
    
    menu.addItem("Reconnect Discord", reconnectFn, [&]() -> std::string {
        return g_discordConnected ? "Connected" : "Disconnected";
    });
    
    menu.addItem("Clear Activity", [&activityHandler]() {
        activityHandler->handleClearActivity();
        Log::ok("Activity cleared");
    });
    
    menu.addItem("View Logs", [&menu]() {
        menu.openLogs();
    });
    
    menu.addItem("Change Port", [&server, &menu]() {
        static const int ports[] = {8765, 8766, 8080, 9090, 3000};
        int cur = server.getPort();
        int next = ports[0];
        for (int i = 0; i < 5; ++i) {
            if (ports[i] == cur && i + 1 < 5) { next = ports[i + 1]; break; }
        }
        if (cur == ports[4]) next = ports[0];
        server.stop();
        server.setPort(next);
        if (server.start()) {
            Log::ok("Port changed to " + std::to_string(next));
        } else {
            Log::err("Failed on port " + std::to_string(next) + ", reverting");
            server.setPort(cur);
            server.start();
        }
    }, [&server]() -> std::string {
        return ":" + std::to_string(server.getPort());
    });
    
    menu.addItem("Hide to Tray", [&tray]() {
        HWND console = GetConsoleWindow();
        if (console) ShowWindow(console, SW_HIDE);
        tray.showBalloon("WebRPC", "Minimized to tray. Double-click to restore.");
    });
    
    menu.addItem("Start with Windows", [&]() {
        bool current = TrayManager::isAutoStartEnabled();
        TrayManager::setAutoStart(!current);
        Log::ok(std::string("Autostart ") + (!current ? "enabled" : "disabled"));
    }, []() -> std::string {
        return TrayManager::isAutoStartEnabled() ? "ON" : "OFF";
    }, true);
    
    menu.addItem("Exit", exitFn);
    
    menu.init();
    Log::menuMode = true;  
    menu.render();
    menu.run();
    
    int refreshCounter = 0;
    while (g_running && server.isRunning()) {
        discordManager->update();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        
        refreshCounter++;
        if (refreshCounter >= 20) {
            refreshCounter = 0;
            menu.render();
        }
    }
    
    menu.stop();
    Log::menuMode = false;
    tray.shutdown();
#else
    
    while (g_running && server.isRunning()) {
        discordManager->update();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
#endif
    
    Log::info("Shutting down...");
    server.stop();
    discordManager->shutdown();
    
#ifdef _WIN32
    CONSOLE_CURSOR_INFO ci;
    ci.dwSize = 25;
    ci.bVisible = TRUE;
    SetConsoleCursorInfo(GetStdHandle(STD_OUTPUT_HANDLE), &ci);
#endif
    
    Log::ok("WebRPC Client stopped. Goodbye!");
    return 0;
}
