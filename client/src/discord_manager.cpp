#include "../include/discord_manager.hpp"
#include "../include/asset_manager.hpp"
#include "../include/logger.hpp"
#include <iostream>
#include <sstream>
#include <memory>
#include <algorithm>
#include <discord-rpc.hpp>

namespace webrpc {

DiscordManager::DiscordManager() 
    : connected_(false), clientId_("1505947337036660947"), initialized_(false) {
    assetManager_ = std::make_shared<AssetManager>();
}

DiscordManager::~DiscordManager() {
#ifdef USE_DISCORD_RPC
    if (initialized_) {
        discord::RPCManager::get().shutdown();
    }
#endif
}

bool DiscordManager::initialize(const std::string& clientId) {
#ifdef USE_DISCORD_RPC
    clientId_ = clientId;
    
    discord::RPCManager::get()
        .setClientID(clientId_)
        .onReady([](discord::User const& user) {
            Log::connection(true, std::string(user.username));
        })
        .onDisconnected([](int errcode, std::string_view message) {
            Log::connection(false);
        })
        .onErrored([](int errcode, std::string_view message) {
            Log::err("Discord: " + std::string(message));
        })
        .initialize();
    
    initialized_ = true;
    connected_ = true;
    
    return true;
#else
    Log::warn("Discord RPC disabled (USE_DISCORD_RPC not defined)");
    return false;
#endif
}

void DiscordManager::shutdown() {
#ifdef USE_DISCORD_RPC
    discord::RPCManager::get().shutdown();
    connected_ = false;
#endif
}

void DiscordManager::setActivity(const ActivityData& activity) {
#ifdef USE_DISCORD_RPC
    if (!connected_) {
        Log::warn("Discord not connected");
        return;
    }
    
    Log::debug("Discord setActivity: details=" + activity.details + " state=" + activity.state);
    
    auto& presence = discord::RPCManager::get().getPresence();
    presence.clear();
    
    presence.setDetails(activity.details);
    presence.setState(activity.state);
    
    if (activity.startTimestamp > 0) {
        presence.setStartTimestamp(activity.startTimestamp);
        if (activity.endTimestamp > 0) {
            presence.setEndTimestamp(activity.endTimestamp);
        }
    }
    
    std::string largeKey = activity.largeImage;
    if (largeKey.empty() || largeKey.find("data:") == 0) {
        largeKey = "webrpc";
    }
    presence.setLargeImageKey(largeKey);
    presence.setLargeImageText(activity.largeText.empty() ? "WebRPC" : activity.largeText);
    
    std::string smallAssetKey;
    if (activity.type == "page" || activity.type == "coding") {
        smallAssetKey = "icon_globe";
    } else if (activity.type == "video") {
        smallAssetKey = "icon_video";
    } else if (activity.type == "music") {
        smallAssetKey = "icon_sound";
    } else {
        smallAssetKey = "webrpc"; 
    }
    
    presence.setSmallImageKey(smallAssetKey);
    presence.setSmallImageText(activity.smallText.empty() ? "Browsing" : activity.smallText);
    
    if (!activity.button1Label.empty() && !activity.button1Url.empty() && activity.button1Url.find("http") == 0) {
        presence.setButton1(activity.button1Label, activity.button1Url, true);
    } else {
        presence.getButton1().setEnabled(false);
    }
    
    if (!activity.button2Label.empty() && !activity.button2Url.empty() && activity.button2Url.find("http") == 0) {
        presence.setButton2(activity.button2Label, activity.button2Url, true);
    } else {
        presence.getButton2().setEnabled(false);
    }
    
    if (activity.type == "video") {
        presence.setActivityType(discord::ActivityType::Watching);
    } else if (activity.type == "music") {
        presence.setActivityType(discord::ActivityType::Listening);
    } else {
        presence.setActivityType(discord::ActivityType::Game);
    }
    
    discord::RPCManager::get().refresh();
    Log::debug("Discord presence refreshed successfully!");
#endif
}

void DiscordManager::clearActivity() {
#ifdef USE_DISCORD_RPC
    discord::RPCManager::get().clearPresence();
    Log::debug("Discord presence cleared");
#endif
}

void DiscordManager::setAssetProvider(std::function<std::string(const std::string&)> provider) {
    assetProvider_ = provider;
}

void DiscordManager::update() {
#ifdef USE_DISCORD_RPC
    discord::RPCManager::get().update();
#endif
}

} 
