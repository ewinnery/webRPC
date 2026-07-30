#pragma once
#ifndef CONSOLE_MENU_HPP
#define CONSOLE_MENU_HPP

#ifdef _WIN32

#include <string>
#include <vector>
#include <functional>
#include <atomic>
#include <thread>
#include <mutex>

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "logger.hpp"

namespace webrpc {

struct MenuItem {
    std::string label;
    std::function<std::string()> statusFn;
    std::function<void()> action;
    bool isToggle = false;
};

enum Attr : WORD {
    A_RESET     = 0x07,
    A_WHITE     = 0x0F,
    A_GRAY      = 0x08,
    A_CYAN      = 0x0B,
    A_GREEN     = 0x0A,
    A_YELLOW    = 0x0E,
    A_RED       = 0x0C,
    A_MAGENTA   = 0x0D,
    A_BLUE      = 0x09,
    A_SEL_BG    = 0x19,
    A_SEL_LABEL = 0x1F,
    A_SEL_CYAN  = 0x1B,
};

enum class View { MAIN, LOGS };

class ConsoleMenu {
public:
    ConsoleMenu() : selected_(0), running_(false), hBack_(INVALID_HANDLE_VALUE), view_(View::MAIN), logScroll_(0) {}

    ~ConsoleMenu() {
        stop();
        if (hBack_ != INVALID_HANDLE_VALUE) CloseHandle(hBack_);
    }

    void addItem(const std::string& label, std::function<void()> action,
                 std::function<std::string()> statusFn = nullptr, bool isToggle = false) {
        items_.push_back({label, statusFn, action, isToggle});
    }

    void setStatusLine(std::function<std::string()> fn) { statusFn_ = fn; }

    void init() {
        hFront_ = GetStdHandle(STD_OUTPUT_HANDLE);

        hBack_ = CreateConsoleScreenBuffer(
            GENERIC_READ | GENERIC_WRITE, FILE_SHARE_WRITE, nullptr,
            CONSOLE_TEXTMODE_BUFFER, nullptr);

        CONSOLE_SCREEN_BUFFER_INFO csbi;
        GetConsoleScreenBufferInfo(hFront_, &csbi);
        width_ = csbi.dwSize.X;
        height_ = csbi.dwSize.Y;
        SetConsoleScreenBufferSize(hBack_, csbi.dwSize);

        CONSOLE_CURSOR_INFO ci = {1, FALSE};
        SetConsoleCursorInfo(hFront_, &ci);
        SetConsoleCursorInfo(hBack_, &ci);

        HANDLE hIn = GetStdHandle(STD_INPUT_HANDLE);
        DWORD inMode = 0;
        GetConsoleMode(hIn, &inMode);
        SetConsoleMode(hIn, (inMode | ENABLE_WINDOW_INPUT) & ~ENABLE_QUICK_EDIT_MODE);

        buf_.resize(width_ * height_);
    }

    void run() {
        running_ = true;
        inputThread_ = std::thread([this]() {
            HANDLE hIn = GetStdHandle(STD_INPUT_HANDLE);
            while (running_) {
                DWORD count = 0;
                INPUT_RECORD rec;
                if (WaitForSingleObject(hIn, 50) == WAIT_OBJECT_0) {
                    ReadConsoleInputW(hIn, &rec, 1, &count);
                    if (count > 0 && rec.EventType == KEY_EVENT && rec.Event.KeyEvent.bKeyDown) {
                        WORD vk = rec.Event.KeyEvent.wVirtualKeyCode;
                        wchar_t ch = rec.Event.KeyEvent.uChar.UnicodeChar;

                        if (view_ == View::LOGS) {
                            handleLogInput(vk, ch);
                        } else {
                            handleMenuInput(vk, ch);
                        }
                        render();
                    }
                }
            }
        });
    }

    void stop() {
        running_ = false;
        if (inputThread_.joinable()) inputThread_.join();
        if (hFront_ != INVALID_HANDLE_VALUE) {
            SetConsoleActiveScreenBuffer(hFront_);
            CONSOLE_CURSOR_INFO ci = {25, TRUE};
            SetConsoleCursorInfo(hFront_, &ci);
        }
    }

    void render() {
        std::lock_guard<std::mutex> lock(renderMutex_);

        CHAR_INFO blank;
        blank.Char.UnicodeChar = L' ';
        blank.Attributes = A_RESET;
        std::fill(buf_.begin(), buf_.end(), blank);

        if (view_ == View::LOGS) {
            renderLogView();
        } else {
            renderMainView();
        }

        COORD bufSize = {(SHORT)width_, (SHORT)height_};
        COORD bufCoord = {0, 0};
        SMALL_RECT writeRegion = {0, 0, (SHORT)(width_ - 1), (SHORT)(height_ - 1)};
        WriteConsoleOutputW(hBack_, buf_.data(), bufSize, bufCoord, &writeRegion);
        SetConsoleActiveScreenBuffer(hBack_);
    }

    void captureStartPosition() {}

    void openLogs() {
        view_ = View::LOGS;
        logScroll_ = scrollToEnd();
    }

private:
    std::vector<MenuItem> items_;
    int selected_;
    std::atomic<bool> running_;
    std::thread inputThread_;
    std::mutex renderMutex_;
    std::function<std::string()> statusFn_;

    HANDLE hFront_ = INVALID_HANDLE_VALUE;
    HANDLE hBack_ = INVALID_HANDLE_VALUE;
    int width_ = 80;
    int height_ = 30;
    std::vector<CHAR_INFO> buf_;

    View view_;
    int logScroll_;

    void setBuf(int row, int col, wchar_t ch, WORD attr) {
        if (row < 0 || row >= height_ || col < 0 || col >= width_) return;
        auto& ci = buf_[row * width_ + col];
        ci.Char.UnicodeChar = ch;
        ci.Attributes = attr;
    }

    void putStr(int row, int col, const wchar_t* str, WORD attr) {
        for (int i = 0; str[i] && col + i < width_; ++i)
            setBuf(row, col + i, str[i], attr);
    }

    void putLine(int row, const wchar_t* str, WORD attr) {
        putStr(row, 0, str, attr);
    }

    void hLine(int row, int x, int len, WORD attr) {
        for (int i = 0; i < len && x + i < width_; ++i)
            setBuf(row, x + i, L'\u2500', attr);
    }

    WORD logAttr(const std::string& line) {
        if (line.find("[OK]") == 0) return A_GREEN;
        if (line.find("[XX]") == 0) return A_RED;
        if (line.find("[!!]") == 0) return A_YELLOW;
        if (line.find("[->]") == 0) return A_MAGENTA;
        if (line.find("[DB]") == 0) return A_GRAY;
        if (line.find("[..]") == 0) return A_BLUE;
        return A_GRAY;
    }

    int drawBanner(int row) {
        const wchar_t* bannerLines[] = {
            L"   \u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588          \u2588\u2588\u2588\u2588\u2588     \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
            L"  \u2591\u2591\u2588\u2588\u2588   \u2591\u2588\u2588\u2588  \u2591\u2591\u2588\u2588\u2588          \u2591\u2591\u2588\u2588\u2588     \u2591\u2591\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588 \u2591\u2591\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588  \u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588",
            L"   \u2591\u2588\u2588\u2588   \u2591\u2588\u2588\u2588   \u2591\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588\u2588  \u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2591\u2588\u2588\u2588    \u2591\u2588\u2588\u2588  \u2591\u2588\u2588\u2588    \u2591\u2588\u2588\u2588 \u2591\u2588\u2588\u2588    \u2591\u2591\u2591",
            L"   \u2591\u2588\u2588\u2588   \u2591\u2588\u2588\u2588   \u2591\u2588\u2588\u2588  \u2588\u2588\u2588\u2591\u2591\u2588\u2588\u2588 \u2591\u2588\u2588\u2588\u2591\u2591\u2588\u2588\u2588 \u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2591\u2588\u2588\u2588",
            L"   \u2591\u2591\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588  \u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2591\u2588\u2588\u2588 \u2591\u2588\u2588\u2588 \u2591\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588  \u2591\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591   \u2591\u2588\u2588\u2588",
            L"    \u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2591\u2588\u2588\u2588\u2588\u2588\u2591   \u2591\u2588\u2588\u2588\u2591\u2591\u2591   \u2591\u2588\u2588\u2588 \u2591\u2588\u2588\u2588 \u2591\u2588\u2588\u2588    \u2591\u2588\u2588\u2588  \u2591\u2588\u2588\u2588         \u2591\u2591\u2588\u2588\u2588     \u2588\u2588\u2588",
            L"      \u2591\u2591\u2588\u2588\u2588 \u2591\u2591\u2588\u2588\u2588     \u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2588         \u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
            L"       \u2591\u2591\u2591   \u2591\u2591\u2591       \u2591\u2591\u2591\u2591\u2591\u2591  \u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591  \u2591\u2591\u2591\u2591\u2591   \u2591\u2591\u2591\u2591\u2591 \u2591\u2591\u2591\u2591\u2591           \u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591",
        };
        for (int i = 0; i < 8; ++i) putLine(row++, bannerLines[i], A_CYAN);
        return row;
    }

    void renderMainView() {
        int row = drawBanner(0);
        row++;

        putStr(row, 3, L"Discord Rich Presence for Browser", A_GRAY);
        putStr(row, 37, L"  |  ", A_RESET);
        putStr(row, 42, L"v1.0.0", A_YELLOW);
        row++;
        hLine(row, 3, 50, A_GRAY);
        row += 2;

        if (statusFn_) {
            std::string s = statusFn_();
            std::wstring ws(s.begin(), s.end());
            putStr(row, 3, ws.c_str(), A_WHITE);
        }
        row++;
        hLine(row, 3, 50, A_GRAY);
        row += 2;

        putStr(row, 3, L"MENU", A_CYAN);
        putStr(row, 8, L" \u2502 \u2191\u2193 or W/S to move, Enter to select", A_GRAY);
        row += 2;

        for (int i = 0; i < (int)items_.size(); ++i) {
            bool sel = (i == selected_);

            if (sel) {
                for (int x = 2; x < width_ - 2 && x < 62; ++x)
                    setBuf(row, x, L' ', A_SEL_BG);
            }

            int col = 3;
            if (sel) { putStr(row, col, L"\u25B6 ", A_SEL_CYAN); }
            col += 2;

            wchar_t numBuf[8];
            swprintf_s(numBuf, L"[%d] ", i + 1);
            putStr(row, col, numBuf, sel ? A_SEL_LABEL : A_GRAY);
            col += (int)wcslen(numBuf);

            std::wstring wlabel(items_[i].label.begin(), items_[i].label.end());
            putStr(row, col, wlabel.c_str(), sel ? A_SEL_LABEL : A_WHITE);
            col += (int)wlabel.size();

            if (items_[i].statusFn) {
                std::string status = items_[i].statusFn();
                col += 2;
                if (items_[i].isToggle) {
                    if (status == "ON" || status == "Enabled")
                        putStr(row, col, L"[\u2713 ON]", sel ? (WORD)0x1A : A_GREEN);
                    else
                        putStr(row, col, L"[\u2717 OFF]", sel ? (WORD)0x1C : A_RED);
                } else {
                    std::wstring ws(status.begin(), status.end());
                    putStr(row, col, ws.c_str(), sel ? (WORD)0x1E : A_YELLOW);
                }
            }
            row++;
        }

        row++;
        hLine(row, 3, 50, A_GRAY);
        row++;

        putStr(row, 3, L"LOG", A_GRAY);
        putStr(row, 7, L"  (press L for full log view)", A_GRAY);
        row++;

        {
            std::lock_guard<std::mutex> logLock(Log::logMutex);
            int maxShow = 6;
            int start = (int)Log::logLines.size() > maxShow ? (int)Log::logLines.size() - maxShow : 0;
            int shown = 0;
            for (int i = start; i < (int)Log::logLines.size(); ++i) {
                const auto& line = Log::logLines[i];
                std::string truncated = line.size() > 56 ? line.substr(0, 53) + "..." : line;
                std::wstring wl(truncated.begin(), truncated.end());
                putStr(row, 3, wl.c_str(), logAttr(line));
                row++;
                shown++;
            }
            for (int i = shown; i < maxShow; ++i) row++;
        }

        row++;
        putStr(row, 3, L"Q quit  |  L logs", A_GRAY);
    }

    void renderLogView() {
        int row = 0;

        for (int x = 0; x < width_; ++x) setBuf(row, x, L' ', A_SEL_BG);
        putStr(row, 2, L"\u25C0 ESC/Backspace to go back", A_SEL_LABEL);
        putStr(row, 35, L"DETAILED LOGS", A_SEL_CYAN);
        row++;
        hLine(row, 0, width_, A_GRAY);
        row++;

        putStr(row, 2, L"\u2191\u2193 scroll  |  Home/End jump  |  V toggle verbose  |  C clear", A_GRAY);
        row++;

        putStr(row, 2, L"Verbose:", A_GRAY);
        if (Log::verbose) putStr(row, 11, L" ON", A_GREEN);
        else              putStr(row, 11, L" OFF", A_RED);
        row++;
        hLine(row, 0, width_, A_GRAY);
        row++;

        int logAreaHeight = height_ - row - 1;  

        std::lock_guard<std::mutex> logLock(Log::logMutex);
        int totalLines = (int)Log::logLines.size();

        int maxScroll = totalLines > logAreaHeight ? totalLines - logAreaHeight : 0;
        if (logScroll_ > maxScroll) logScroll_ = maxScroll;
        if (logScroll_ < 0) logScroll_ = 0;

        int startIdx = logScroll_;
        int endIdx = startIdx + logAreaHeight;
        if (endIdx > totalLines) endIdx = totalLines;

        for (int i = startIdx; i < endIdx; ++i) {
            const auto& line = Log::logLines[i];
            int maxLen = width_ - 4;
            std::string display = line.size() > (size_t)maxLen ? line.substr(0, maxLen - 3) + "..." : line;
            std::wstring wl(display.begin(), display.end());
            putStr(row, 2, wl.c_str(), logAttr(line));
            row++;
        }

        int footerRow = height_ - 1;
        for (int x = 0; x < width_; ++x) setBuf(footerRow, x, L' ', A_SEL_BG);
        wchar_t footBuf[80];
        swprintf_s(footBuf, L" Lines %d-%d of %d", startIdx + 1, endIdx, totalLines);
        putStr(footerRow, 2, footBuf, A_SEL_LABEL);
    }

    void handleMenuInput(WORD vk, wchar_t ch) {
        switch (vk) {
            case VK_UP:    moveUp(); break;
            case VK_DOWN:  moveDown(); break;
            case VK_RETURN: executeSelected(); break;
            default:
                if (ch == L'w' || ch == L'W') moveUp();
                else if (ch == L's' || ch == L'S') moveDown();
                else if (ch == L'q' || ch == L'Q') triggerExit();
                else if (ch == L'l' || ch == L'L') { view_ = View::LOGS; logScroll_ = scrollToEnd(); }
                else if (ch >= L'1' && ch <= L'9') {
                    int idx = ch - L'1';
                    if (idx < (int)items_.size()) { selected_ = idx; executeSelected(); }
                }
                break;
        }
    }

    void handleLogInput(WORD vk, wchar_t ch) {
        switch (vk) {
            case VK_ESCAPE:
            case VK_BACK:
                view_ = View::MAIN;
                break;
            case VK_UP:    logScroll_--; break;
            case VK_DOWN:  logScroll_++; break;
            case VK_PRIOR: logScroll_ -= (height_ - 6); break;  
            case VK_NEXT:  logScroll_ += (height_ - 6); break;  
            case VK_HOME:  logScroll_ = 0; break;
            case VK_END:   logScroll_ = scrollToEnd(); break;
            default:
                if (ch == L'w' || ch == L'W') logScroll_--;
                else if (ch == L's' || ch == L'S') logScroll_++;
                else if (ch == L'v' || ch == L'V') { Log::verbose = !Log::verbose; }
                else if (ch == L'c' || ch == L'C') {
                    std::lock_guard<std::mutex> logLock(Log::logMutex);
                    Log::logLines.clear();
                    logScroll_ = 0;
                }
                else if (ch == L'q' || ch == L'Q' || ch == L'l' || ch == L'L')
                    view_ = View::MAIN;
                break;
        }
    }

    int scrollToEnd() {
        std::lock_guard<std::mutex> logLock(Log::logMutex);
        int logAreaH = height_ - 6;
        int total = (int)Log::logLines.size();
        return total > logAreaH ? total - logAreaH : 0;
    }

    void moveUp() {
        selected_--;
        if (selected_ < 0) selected_ = (int)items_.size() - 1;
    }

    void moveDown() {
        selected_++;
        if (selected_ >= (int)items_.size()) selected_ = 0;
    }

    void executeSelected() {
        if (selected_ >= 0 && selected_ < (int)items_.size())
            items_[selected_].action();
    }

    void triggerExit() {
        for (auto& item : items_) {
            if (item.label.find("Exit") != std::string::npos) {
                item.action();
                return;
            }
        }
    }
};

} 

#endif 
#endif 
