#include "../include/json_handler.hpp"
#include <sstream>
#include <cstdint>

namespace webrpc {

std::string JsonHandler::stringify(const std::map<std::string, std::any>& obj) {
    std::ostringstream oss;
    oss << "{";
    
    bool first = true;
    for (const auto& [key, value] : obj) {
        if (!first) {
            oss << ",";
        }
        first = false;
        
        oss << "\"" << escapeString(key) << "\":";
        
        try {
            int intVal = std::any_cast<int>(value);
            oss << intVal;
        } catch (const std::bad_any_cast&) {
            try {
                bool boolVal = std::any_cast<bool>(value);
            oss << (boolVal ? "true" : "false");
            } catch (const std::bad_any_cast&) {
                try {
                    std::string strVal = std::any_cast<std::string>(value);
                    oss << "\"" << escapeString(strVal) << "\"";
                } catch (const std::bad_any_cast&) {
                    oss << "null";
                }
            }
        }
    }
    
    oss << "}";
    return oss.str();
}

std::map<std::string, std::any> JsonHandler::parse(const std::string& json) {
    std::map<std::string, std::any> result;
    
    size_t pos = 0;
    while (pos < json.length()) {
        
        while (pos < json.length() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\n' || json[pos] == '\r')) {
            pos++;
        }
        
        if (pos >= json.length() || json[pos] != '"') {
            pos++;
            continue;
        }
        
        pos++; 
        std::string key;
        while (pos < json.length() && json[pos] != '"') {
            if (json[pos] == '\\' && pos + 1 < json.length()) {
                pos++; 
            }
            key += json[pos];
            pos++;
        }
        if (pos >= json.length()) break;
        pos++; 
        
        while (pos < json.length() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\n' || json[pos] == '\r')) {
            pos++;
        }
        if (pos >= json.length() || json[pos] != ':') {
            pos++;
            continue;
        }
        pos++; 
        
        while (pos < json.length() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\n' || json[pos] == '\r')) {
            pos++;
        }
        
        if (pos >= json.length()) break;
        
        if (json[pos] == '"') {
            
            pos++; 
            std::string value;
            while (pos < json.length() && json[pos] != '"') {
                if (json[pos] == '\\' && pos + 1 < json.length()) {
                    pos++; 
                }
                value += json[pos];
                pos++;
            }
            if (pos >= json.length()) break;
            pos++; 
            
            std::string unescaped;
            for (size_t i = 0; i < value.length(); ++i) {
                if (value[i] == '\\' && i + 1 < value.length()) {
                    switch (value[i + 1]) {
                        case '"': unescaped += '"'; ++i; break;
                        case '\\': unescaped += '\\'; ++i; break;
                        case 'n': unescaped += '\n'; ++i; break;
                        case 'r': unescaped += '\r'; ++i; break;
                        case 't': unescaped += '\t'; ++i; break;
                        default: unescaped += value[i + 1]; ++i; break;
                    }
                } else {
                    unescaped += value[i];
                }
            }
            result[key] = unescaped;
        } else if (json[pos] == 't' || json[pos] == 'f') {
            
            std::string boolStr;
            while (pos < json.length() && json[pos] != ',' && json[pos] != '}') {
                boolStr += json[pos];
                pos++;
            }
            result[key] = (boolStr == "true");
        } else if ((json[pos] >= '0' && json[pos] <= '9') || json[pos] == '-') {
            
            std::string numStr;
            bool isFloat = false;
            while (pos < json.length() && ((json[pos] >= '0' && json[pos] <= '9') || json[pos] == '-' || json[pos] == '.' || json[pos] == 'e' || json[pos] == 'E' || json[pos] == '+')) {
                if (json[pos] == '.' || json[pos] == 'e' || json[pos] == 'E') isFloat = true;
                numStr += json[pos];
                pos++;
            }
            if (!numStr.empty()) {
                try {
                    if (isFloat) {
                        result[key] = static_cast<int64_t>(std::stod(numStr));
                    } else {
                        result[key] = std::stoll(numStr);
                    }
                } catch (...) {
                    result[key] = static_cast<int64_t>(0);
                }
            }
        } else if (json[pos] == 'n') {
            
            while (pos < json.length() && json[pos] != ',' && json[pos] != '}') pos++;
            
        } else {
            pos++; 
        }
        
        while (pos < json.length() && json[pos] != ',' && json[pos] != '}') {
            pos++;
        }
        if (pos < json.length() && json[pos] == ',') {
            pos++;
        }
    }
    
    return result;
}

std::string JsonHandler::getString(const std::map<std::string, std::any>& obj, const std::string& key, const std::string& defaultValue) {
    auto it = obj.find(key);
    if (it != obj.end()) {
        try {
            return std::any_cast<std::string>(it->second);
        } catch (const std::bad_any_cast&) {
            return defaultValue;
        }
    }
    return defaultValue;
}

int JsonHandler::getInt(const std::map<std::string, std::any>& obj, const std::string& key, int defaultValue) {
    auto it = obj.find(key);
    if (it != obj.end()) {
        try {
            return static_cast<int>(std::any_cast<int64_t>(it->second));
        } catch (const std::bad_any_cast&) {
            return defaultValue;
        }
    }
    return defaultValue;
}

int64_t JsonHandler::getInt64(const std::map<std::string, std::any>& obj, const std::string& key, int64_t defaultValue) {
    auto it = obj.find(key);
    if (it != obj.end()) {
        try {
            return std::any_cast<int64_t>(it->second);
        } catch (const std::bad_any_cast&) {
            return defaultValue;
        }
    }
    return defaultValue;
}

bool JsonHandler::getBool(const std::map<std::string, std::any>& obj, const std::string& key, bool defaultValue) {
    auto it = obj.find(key);
    if (it != obj.end()) {
        try {
            return std::any_cast<bool>(it->second);
        } catch (const std::bad_any_cast&) {
            return defaultValue;
        }
    }
    return defaultValue;
}

std::string JsonHandler::escapeString(const std::string& str) {
    std::string result;
    for (char c : str) {
        switch (c) {
            case '"': result += "\\\""; break;
            case '\\': result += "\\\\"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default: result += c; break;
        }
    }
    return result;
}

} 
