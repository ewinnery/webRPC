#include "../include/asset_manager.hpp"
#include <fstream>
#include <sstream>
#include <filesystem>
#include <algorithm>
#include <random>

#ifdef _WIN32
    #include <shlobj.h>
    #include <windows.h>
#else
    #include <sys/stat.h>
    #include <pwd.h>
#endif

namespace webrpc {

AssetManager::AssetManager() {
    ensureCacheDirectory();
}

AssetManager::~AssetManager() {
}

std::string AssetManager::downloadAndCache(const std::string& url) {
    std::lock_guard<std::mutex> lock(cacheMutex_);
    
    auto it = urlToPath_.find(url);
    if (it != urlToPath_.end()) {
        return it->second;
    }
    
    std::string cacheFile = cacheDir_ + "/" + generateCacheFileName(url);
    
    if (downloadFile(url, cacheFile)) {
        urlToPath_[url] = cacheFile;
        return cacheFile;
    }
    
    return "";
}

std::string AssetManager::getCachedPath(const std::string& url) {
    std::lock_guard<std::mutex> lock(cacheMutex_);
    
    auto it = urlToPath_.find(url);
    if (it != urlToPath_.end()) {
        return it->second;
    }
    
    return "";
}

bool AssetManager::isCached(const std::string& url) {
    std::lock_guard<std::mutex> lock(cacheMutex_);
    return urlToPath_.find(url) != urlToPath_.end();
}

void AssetManager::clearCache() {
    std::lock_guard<std::mutex> lock(cacheMutex_);
    
    try {
        for (const auto& entry : std::filesystem::directory_iterator(cacheDir_)) {
            if (entry.is_regular_file()) {
                std::filesystem::remove(entry.path());
            }
        }
        urlToPath_.clear();
    } catch (const std::exception& e) {
        
    }
}

std::string AssetManager::getCacheDirectory() {
    return cacheDir_;
}

void AssetManager::ensureCacheDirectory() {
#ifdef _WIN32
    char appDataPath[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_APPDATA, NULL, 0, appDataPath))) {
        cacheDir_ = std::string(appDataPath) + "\\webrpc\\cache";
    } else {
        cacheDir_ = ".\\cache";
    }
#else
    const char* homeDir = getenv("HOME");
    if (!homeDir) {
        struct passwd* pw = getpwuid(getuid());
        homeDir = pw ? pw->pw_dir : ".";
    }
    cacheDir_ = std::string(homeDir) + "/.webrpc/cache";
#endif
    
    try {
        std::filesystem::create_directories(cacheDir_);
    } catch (const std::exception& e) {
        
        cacheDir_ = "./cache";
        std::filesystem::create_directories(cacheDir_);
    }
}

std::string AssetManager::generateCacheFileName(const std::string& url) {
    
    std::hash<std::string> hasher;
    size_t hash = hasher(url);
    
    std::string extension = ".png";
    size_t dotPos = url.find_last_of('.');
    if (dotPos != std::string::npos && dotPos < url.find('?')) {
        extension = url.substr(dotPos);
        
        if (extension.length() > 5) {
            extension = ".png";
        }
    }
    
    std::ostringstream oss;
    oss << std::hex << hash << extension;
    return oss.str();
}

bool AssetManager::downloadFile(const std::string& url, const std::string& destination) {
    
    return false;
}

} 
