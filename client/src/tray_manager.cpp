#ifdef _WIN32

#include "../include/tray_manager.hpp"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <shellapi.h>

#define WM_TRAYICON (WM_USER + 1)
#define ID_TRAY_RECONNECT 1001
#define ID_TRAY_TOGGLE    1002
#define ID_TRAY_AUTOSTART 1004
#define ID_TRAY_EXIT      1003

static const wchar_t* AUTOSTART_KEY = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
static const wchar_t* AUTOSTART_NAME = L"WebRPC";

static webrpc::TrayManager* g_trayInstance = nullptr;

namespace webrpc {

TrayManager::TrayManager() : running_(false) {
    nid_ = new NOTIFYICONDATAW();
}

TrayManager::~TrayManager() {
    shutdown();
    delete static_cast<NOTIFYICONDATAW*>(nid_);
}

bool TrayManager::initialize(const std::string& tooltip) {
    g_trayInstance = this;
    running_ = true;
    
    trayThread_ = std::thread([this, tooltip]() {
        
        WNDCLASSEXW wc = {};
        wc.cbSize = sizeof(WNDCLASSEXW);
        wc.lpfnWndProc = reinterpret_cast<WNDPROC>(TrayManager::WndProc);
        wc.hInstance = GetModuleHandleW(nullptr);
        wc.lpszClassName = L"WebRPCTrayClass";
        RegisterClassExW(&wc);
        
        hwnd_ = CreateWindowExW(0, L"WebRPCTrayClass", L"WebRPC", 0,
            0, 0, 0, 0, HWND_MESSAGE, nullptr, wc.hInstance, nullptr);
        
        if (!hwnd_) {
            running_ = false;
            return;
        }
        
        createTrayIcon(tooltip);
        runMessageLoop();
    });
    
    return true;
}

void TrayManager::shutdown() {
    if (!running_) return;
    running_ = false;
    
    if (hwnd_) {
        PostMessageW(static_cast<HWND>(hwnd_), WM_QUIT, 0, 0);
    }
    
    if (trayThread_.joinable()) {
        trayThread_.join();
    }
    
    removeTrayIcon();
}

void TrayManager::createTrayIcon(const std::string& tooltip) {
    auto* nid = static_cast<NOTIFYICONDATAW*>(nid_);
    memset(nid, 0, sizeof(NOTIFYICONDATAW));
    nid->cbSize = sizeof(NOTIFYICONDATAW);
    nid->hWnd = static_cast<HWND>(hwnd_);
    nid->uID = 1;
    nid->uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    nid->uCallbackMessage = WM_TRAYICON;
    
    nid->hIcon = static_cast<HICON>(LoadImageW(nullptr, 
        reinterpret_cast<LPCWSTR>(IDI_APPLICATION), IMAGE_ICON, 0, 0, LR_SHARED));
    
    std::wstring wtip(tooltip.begin(), tooltip.end());
    wcsncpy_s(nid->szTip, wtip.c_str(), 127);
    
    Shell_NotifyIconW(NIM_ADD, nid);
}

void TrayManager::removeTrayIcon() {
    if (nid_) {
        Shell_NotifyIconW(NIM_DELETE, static_cast<NOTIFYICONDATAW*>(nid_));
    }
}

void TrayManager::setStatus(const std::string& status) {
    auto* nid = static_cast<NOTIFYICONDATAW*>(nid_);
    std::wstring wtip = L"WebRPC - ";
    std::wstring ws(status.begin(), status.end());
    wtip += ws;
    wcsncpy_s(nid->szTip, wtip.c_str(), 127);
    nid->uFlags = NIF_TIP;
    Shell_NotifyIconW(NIM_MODIFY, nid);
}

void TrayManager::showBalloon(const std::string& title, const std::string& msg) {
    auto* nid = static_cast<NOTIFYICONDATAW*>(nid_);
    nid->uFlags = NIF_INFO;
    nid->dwInfoFlags = NIIF_INFO;
    
    std::wstring wtitle(title.begin(), title.end());
    std::wstring wmsg(msg.begin(), msg.end());
    wcsncpy_s(nid->szInfoTitle, wtitle.c_str(), 63);
    wcsncpy_s(nid->szInfo, wmsg.c_str(), 255);
    
    Shell_NotifyIconW(NIM_MODIFY, nid);
}

bool TrayManager::isAutoStartEnabled() {
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, AUTOSTART_KEY, 0, KEY_READ, &hKey) != ERROR_SUCCESS) {
        return false;
    }
    
    DWORD type = 0;
    DWORD size = 0;
    bool exists = (RegQueryValueExW(hKey, AUTOSTART_NAME, nullptr, &type, nullptr, &size) == ERROR_SUCCESS);
    RegCloseKey(hKey);
    return exists;
}

void TrayManager::setAutoStart(bool enable) {
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, AUTOSTART_KEY, 0, KEY_WRITE, &hKey) != ERROR_SUCCESS) {
        return;
    }
    
    if (enable) {
        wchar_t exePath[MAX_PATH];
        GetModuleFileNameW(nullptr, exePath, MAX_PATH);
        
        std::wstring cmd = std::wstring(L"\"" ) + exePath + L"\" --minimized";
        RegSetValueExW(hKey, AUTOSTART_NAME, 0, REG_SZ,
            reinterpret_cast<const BYTE*>(cmd.c_str()),
            static_cast<DWORD>((cmd.size() + 1) * sizeof(wchar_t)));
    } else {
        RegDeleteValueW(hKey, AUTOSTART_NAME);
    }
    
    RegCloseKey(hKey);
}

void TrayManager::showContextMenu() {
    HMENU menu = CreatePopupMenu();
    
    AppendMenuW(menu, MF_STRING, ID_TRAY_RECONNECT, L"Reconnect Discord");
    AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(menu, MF_STRING, ID_TRAY_TOGGLE, 
        consoleVisible_ ? L"Hide Console" : L"Show Console");
    
    UINT autoFlags = MF_STRING | (isAutoStartEnabled() ? MF_CHECKED : MF_UNCHECKED);
    AppendMenuW(menu, autoFlags, ID_TRAY_AUTOSTART, L"Start with Windows");
    
    AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(menu, MF_STRING, ID_TRAY_EXIT, L"Exit");
    
    POINT pt;
    GetCursorPos(&pt);
    SetForegroundWindow(static_cast<HWND>(hwnd_));
    TrackPopupMenu(menu, TPM_RIGHTBUTTON, pt.x, pt.y, 0, static_cast<HWND>(hwnd_), nullptr);
    DestroyMenu(menu);
}

void TrayManager::toggleConsole() {
    HWND console = GetConsoleWindow();
    if (!console) return;
    
    consoleVisible_ = !consoleVisible_;
    ShowWindow(console, consoleVisible_ ? SW_SHOW : SW_HIDE);
    
    if (onToggleConsole) onToggleConsole();
}

void TrayManager::runMessageLoop() {
    MSG msg;
    while (running_ && GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
}

long long __stdcall TrayManager::WndProc(void* hwnd, unsigned int msg, unsigned long long wp, long long lp) {
    if (!g_trayInstance) {
        return DefWindowProcW(static_cast<HWND>(hwnd), msg, static_cast<WPARAM>(wp), static_cast<LPARAM>(lp));
    }
    
    switch (msg) {
        case WM_TRAYICON:
            if (lp == WM_RBUTTONUP || lp == WM_CONTEXTMENU) {
                g_trayInstance->showContextMenu();
            } else if (lp == WM_LBUTTONDBLCLK) {
                g_trayInstance->toggleConsole();
            }
            return 0;
            
        case WM_COMMAND:
            switch (LOWORD(wp)) {
                case ID_TRAY_RECONNECT:
                    if (g_trayInstance->onReconnect) g_trayInstance->onReconnect();
                    break;
                case ID_TRAY_TOGGLE:
                    g_trayInstance->toggleConsole();
                    break;
                case ID_TRAY_AUTOSTART:
                    TrayManager::setAutoStart(!TrayManager::isAutoStartEnabled());
                    break;
                case ID_TRAY_EXIT:
                    if (g_trayInstance->onExit) g_trayInstance->onExit();
                    break;
            }
            return 0;
    }
    
    return DefWindowProcW(static_cast<HWND>(hwnd), msg, static_cast<WPARAM>(wp), static_cast<LPARAM>(lp));
}

} 

#endif 
