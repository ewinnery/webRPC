cmake_minimum_required(VERSION 3.15)
project(WebRPCClient VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(WIN32)
    set(PLATFORM_SOURCES src/platform/windows.cpp src/tray_manager.cpp)
    set(PLATFORM_LIBS ws2_32 shell32 user32 advapi32 wininet)
elseif(APPLE)
    set(PLATFORM_SOURCES src/platform/macos.cpp)
    set(PLATFORM_LIBS "-framework CoreFoundation")
elseif(UNIX)
    set(PLATFORM_SOURCES src/platform/linux.cpp)
    set(PLATFORM_LIBS pthread)
endif()

set(DISCORD_RPC_INCLUDE_PATH "${CMAKE_SOURCE_DIR}/discord-presence/include")
set(DISCORD_RPC_LIB_PATH "${CMAKE_SOURCE_DIR}/discord-presence/build/Release/discord-rpc.lib")
set(FMT_LIB_PATH "${CMAKE_SOURCE_DIR}/discord-presence/build/_deps/fmt-build/Release/fmt.lib")

message(STATUS "Using modern discord-presence library")

add_executable(webrpc-client
    src/main.cpp
    src/http_server.cpp
    src/discord_manager.cpp
    src/activity_handler.cpp
    src/json_handler.cpp
    src/asset_manager.cpp
    ${PLATFORM_SOURCES}
)

target_include_directories(webrpc-client PRIVATE
    include
    ${DISCORD_RPC_INCLUDE_PATH}
)

target_compile_definitions(webrpc-client PRIVATE USE_DISCORD_RPC)

target_link_libraries(webrpc-client
    ${DISCORD_RPC_LIB_PATH}
    ${FMT_LIB_PATH}
    ${PLATFORM_LIBS}
)
