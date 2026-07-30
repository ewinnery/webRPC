#pragma once
#ifndef LOGGER_HPP
#define LOGGER_HPP

#include <string>
#include <iostream>
#include <vector>
#include <deque>
#include <mutex>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <conio.h>
#endif

namespace webrpc {

class Log {
public:
    enum Color { 
        RESET = 7, WHITE = 15, GRAY = 8,
        GREEN = 10, CYAN = 11, YELLOW = 14, 
        RED = 12, MAGENTA = 13, BLUE = 9 
    };

    static inline std::deque<std::string> logLines;
    static inline std::mutex logMutex;
    static inline int maxLogLines = 200;
    static inline bool menuMode = false;   
    static inline bool verbose = false;    

    static void init() {
#ifdef _WIN32
        HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
        DWORD mode = 0;
        GetConsoleMode(hOut, &mode);
        SetConsoleMode(hOut, mode | ENABLE_VIRTUAL_TERMINAL_PROCESSING);
        SetConsoleOutputCP(CP_UTF8);
        SetConsoleTitleW(L"WebRPC Client");
#endif
    }

    static void color(Color c) {
#ifdef _WIN32
        SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE), static_cast<WORD>(c));
#endif
    }

    static void banner() {
        color(CYAN);
        std::cout << R"(
   █████   ███   █████          █████     ███████████   ███████████    █████████
  ░░███   ░███  ░░███          ░░███     ░░███░░░░░███ ░░███░░░░░███  ███░░░░░███
   ░███   ░███   ░███   ██████  ░███████  ░███    ░███  ░███    ░███ ░███    ░░░
   ░███   ░███   ░███  ███░░███ ░███░░███ ░██████████   ░██████████  ░███
   ░░███  █████  ███  ░███████  ░███ ░███ ░███░░░░░███  ░███░░░░░░   ░███
    ░░░█████░█████░   ░███░░░   ░███ ░███ ░███    ░███  ░███         ░░███     ███
      ░░███ ░░███     ░░██████  ████████  █████   █████ █████         ░░█████████
       ░░░   ░░░       ░░░░░░  ░░░░░░░░  ░░░░░   ░░░░░ ░░░░░           ░░░░░░░░░
)";
        color(GRAY);
        std::cout << "   Discord Rich Presence for Browser";
        color(RESET); std::cout << "  |  ";
        color(YELLOW); std::cout << "v1.0.0\n";
        color(GRAY);
        std::cout << "   " << std::string(50, '-') << "\n\n";
        color(RESET);
    }

    static void addLog(const std::string& line) {
        std::lock_guard<std::mutex> lock(logMutex);
        logLines.push_back(line);
        if ((int)logLines.size() > maxLogLines) {
            logLines.pop_front();
        }
    }

    static void ok(const std::string& msg) {
        addLog("[OK] " + msg);
        if (menuMode) return;
        color(GREEN); std::cout << "  [OK] ";
        color(WHITE); std::cout << msg << "\n";
        color(RESET);
    }

    static void info(const std::string& msg) {
        addLog("[**] " + msg);
        if (menuMode) return;
        color(CYAN); std::cout << "  [**] ";
        color(GRAY); std::cout << msg << "\n";
        color(RESET);
    }

    static void warn(const std::string& msg) {
        addLog("[!!] " + msg);
        if (menuMode) return;
        color(YELLOW); std::cout << "  [!!] ";
        color(WHITE); std::cout << msg << "\n";
        color(RESET);
    }

    static void err(const std::string& msg) {
        addLog("[XX] " + msg);
        if (menuMode) return;
        color(RED); std::cout << "  [XX] ";
        color(WHITE); std::cout << msg << "\n";
        color(RESET);
    }

    static void activity(const std::string& type, const std::string& title, const std::string& detail) {
        std::string logStr = type + " | " + title;
        if (!detail.empty()) logStr += " | " + detail;
        addLog("[->] " + logStr);

        if (menuMode) return;
        color(MAGENTA); std::cout << "  [->] ";
        color(YELLOW); std::cout << type;
        color(GRAY); std::cout << " | ";
        color(WHITE); std::cout << title;
        if (!detail.empty()) {
            color(GRAY); std::cout << " | " << detail;
        }
        std::cout << "\n";
        color(RESET);
    }

    static void connection(bool connected, const std::string& user = "") {
        if (connected) {
            addLog("[OK] Discord connected as " + user);
        } else {
            addLog("[XX] Discord disconnected");
        }
        if (menuMode) return;
        if (connected) {
            color(GREEN); std::cout << "  [OK] ";
            color(WHITE); std::cout << "Discord connected";
            if (!user.empty()) {
                color(CYAN); std::cout << " as " << user;
            }
        } else {
            color(RED); std::cout << "  [XX] ";
            color(WHITE); std::cout << "Discord disconnected";
        }
        std::cout << "\n";
        color(RESET);
    }

    static void request(const std::string& method, const std::string& path, int status) {
        if (verbose) {
            addLog("[..] " + method + " " + path + " -> " + std::to_string(status));
        }
        if (menuMode) return;
        color(GRAY); std::cout << "  [..] ";
        color(BLUE); std::cout << method << " " << path;
        color(GRAY); std::cout << " -> ";
        if (status >= 200 && status < 300) {
            color(GREEN);
        } else {
            color(RED);
        }
        std::cout << status << "\n";
        color(RESET);
    }

    static void debug(const std::string& msg) {
        if (!verbose) return;
        addLog("[DB] " + msg);
        if (menuMode) return;
        color(GRAY); std::cout << "  [DB] " << msg << "\n";
        color(RESET);
    }
};

} 

#endif 
