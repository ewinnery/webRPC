#pragma once
#ifndef TRAY_MANAGER_HPP
#define TRAY_MANAGER_HPP

#ifdef _WIN32

#include <string>
#include <functional>
#include <thread>
#include <atomic>

namespace webrpc {

class TrayManager {
public:
    TrayManager();
    ~TrayManager();

    bool initialize(const std::string& tooltip = "WebRPC Client");
    void shutdown();
    
    void setStatus(const std::string& status);
    void showBalloon(const std::string& title, const std::string& msg);
    
    static bool isAutoStartEnabled();
    static void setAutoStart(bool enable);
    
    std::function<void()> onReconnect;
    std::function<void()> onExit;
    std::function<void()> onToggleConsole;

    void runMessageLoop();

private:
    std::atomic<bool> running_;
    std::thread trayThread_;
    void* hwnd_ = nullptr;     
    void* nid_ = nullptr;      
    bool consoleVisible_ = true;
    
    static long long __stdcall WndProc(void* hwnd, unsigned int msg, unsigned long long wp, long long lp);
    void createTrayIcon(const std::string& tooltip);
    void removeTrayIcon();
    void showContextMenu();
    void toggleConsole();
};

} 

#endif 
#endif 
