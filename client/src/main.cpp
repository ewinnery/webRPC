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

int main(int argc, char* argv[]) {
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
            
            if (type == "setActivity" || type == "page" || type == "video" || 
                type == "music" || type == "chat" || type == "social" || type == "coding") {
                activityHandler->handleSetActivity(req.body);
                return HttpResponse(200, R"({"success":true})");
            } else if (type == "clearActivity") {
                activityHandler->handleClearActivity();
                return HttpResponse(200, R"({"success":true})");
            } else {
                Log::warn("Unknown activity type: " + type);
                return HttpResponse(400, R"({"error":"Unknown type"})");
            }
        } catch (const std::exception& e) {
            Log::err(std::string("Request error: ") + e.what());
            return HttpResponse(500, std::string(R"({"error":")") + e.what() + R"("})");
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
