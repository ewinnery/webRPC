#pragma once

#include "discord_manager.hpp"
#include <string>
#include <memory>

namespace webrpc {

class ActivityHandler {
public:
    ActivityHandler(std::shared_ptr<DiscordManager> discordManager);
    ~ActivityHandler();
    
    void handleSetActivity(const std::string& json);
    void handleClearActivity();
    
    std::string getCurrentActivity() const;
    
private:
    std::shared_ptr<DiscordManager> discordManager_;
    ActivityData currentActivity_;
    
    ActivityData parseActivityJson(const std::string& json);
};

} 
