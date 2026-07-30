#pragma once

#ifndef DISCORD_MANAGER_HPP
#define DISCORD_MANAGER_HPP

#include <string>
#include <memory>
#include <functional>

namespace webrpc {

class AssetManager;

struct ActivityData {
    std::string type;
    std::string title;
    std::string url;
    std::string favicon;
    std::string details;
    std::string state;
    std::string largeImage;
    std::string smallImage;
    std::string largeText;
    std::string smallText;
    int64_t startTimestamp = 0;
    int64_t endTimestamp = 0;
    std::string button1Label;
    std::string button1Url;
    std::string button2Label;
    std::string button2Url;
};

class DiscordManager {
public:
    DiscordManager();
    ~DiscordManager();

    bool initialize(const std::string& clientId = "1505947337036660947");
    void shutdown();
    
    void setActivity(const ActivityData& activity);
    void clearActivity();
    
    void setAssetProvider(std::function<std::string(const std::string&)> provider);
    
    void update();

private:
    bool connected_;
    std::string clientId_;
    bool initialized_;
    std::shared_ptr<AssetManager> assetManager_;
    std::function<std::string(const std::string&)> assetProvider_;
};

} 

#endif 
