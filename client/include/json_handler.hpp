#pragma once

#include <string>
#include <map>
#include <vector>
#include <any>

namespace webrpc {

class JsonHandler {
public:
    static std::string stringify(const std::map<std::string, std::any>& obj);
    static std::map<std::string, std::any> parse(const std::string& json);
    
    static std::string getString(const std::map<std::string, std::any>& obj, const std::string& key, const std::string& defaultValue = "");
    static int getInt(const std::map<std::string, std::any>& obj, const std::string& key, int defaultValue = 0);
    static int64_t getInt64(const std::map<std::string, std::any>& obj, const std::string& key, int64_t defaultValue = 0);
    static bool getBool(const std::map<std::string, std::any>& obj, const std::string& key, bool defaultValue = false);
    
private:
    static std::string escapeString(const std::string& str);
};

} 
