#pragma once

#include <string>
#include <unordered_map>
#include <mutex>

namespace webrpc {

class AssetManager {
public:
    AssetManager();
    ~AssetManager();
    
    std::string downloadAndCache(const std::string& url);
    
    std::string getCachedPath(const std::string& url);
    
    bool isCached(const std::string& url);
    
    void clearCache();
    
    std::string getCacheDirectory();
    
private:
    std::string cacheDir_;
    std::unordered_map<std::string, std::string> urlToPath_;
    std::mutex cacheMutex_;
    
    void ensureCacheDirectory();
    std::string generateCacheFileName(const std::string& url);
    bool downloadFile(const std::string& url, const std::string& destination);
};

} 
