#include "../include/activity_handler.hpp"
#include "../include/json_handler.hpp"
#include "../include/logger.hpp"
#include <string>

namespace webrpc {

ActivityHandler::ActivityHandler(std::shared_ptr<DiscordManager> discordManager)
    : discordManager_(discordManager) {
}

ActivityHandler::~ActivityHandler() {
}

void ActivityHandler::handleSetActivity(const std::string& json) {
    try {
        currentActivity_ = parseActivityJson(json);
        discordManager_->setActivity(currentActivity_);
    } catch (const std::exception& e) {
        Log::err(std::string("Activity error: ") + e.what());
    }
}

void ActivityHandler::handleClearActivity() {
    currentActivity_ = ActivityData();
    discordManager_->clearActivity();
}

std::string ActivityHandler::getCurrentActivity() const {
    auto data = JsonHandler::parse("{}");
    
    return "{}";
}

ActivityData ActivityHandler::parseActivityJson(const std::string& json) {
    ActivityData activity;
    
    auto data = JsonHandler::parse(json);
    
    activity.type = JsonHandler::getString(data, "type");
    activity.title = JsonHandler::getString(data, "title");
    activity.url = JsonHandler::getString(data, "url");
    activity.favicon = JsonHandler::getString(data, "favicon");
    activity.details = JsonHandler::getString(data, "details");
    activity.state = JsonHandler::getString(data, "state");
    activity.largeImage = JsonHandler::getString(data, "largeImage");
    activity.smallImage = JsonHandler::getString(data, "smallImage");
    activity.largeText = JsonHandler::getString(data, "largeText");
    activity.smallText = JsonHandler::getString(data, "smallText");
    
    activity.startTimestamp = JsonHandler::getInt64(data, "startTimestamp", 0);
    activity.endTimestamp = JsonHandler::getInt64(data, "endTimestamp", 0);
    if (activity.startTimestamp > 9999999999LL) activity.startTimestamp /= 1000;
    if (activity.endTimestamp > 9999999999LL) activity.endTimestamp /= 1000;
    
    activity.button1Label = JsonHandler::getString(data, "button1Label");
    activity.button1Url = JsonHandler::getString(data, "button1Url");
    activity.button2Label = JsonHandler::getString(data, "button2Label");
    activity.button2Url = JsonHandler::getString(data, "button2Url");
    
    Log::activity(activity.type, activity.title, activity.details);
    Log::debug("  details=" + activity.details + " state=" + activity.state);
    Log::debug("  ts=" + std::to_string(activity.startTimestamp) + "-" + std::to_string(activity.endTimestamp));
    if (!activity.button1Label.empty()) Log::debug("  btn1=" + activity.button1Label);
    
    return activity;
}

} 
