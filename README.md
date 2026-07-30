<p align="center">
  <img src="docs/banner.png" alt="WebRPC Banner" width="520"/>
</p>

<h1 align="center">WebRPC</h1>

<p align="center">
  Браузерное расширение и C++ клиент для отображения активности из браузера в Discord Rich Presence.
</p>

<p align="center">
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Manifest-V3-4285F4.svg?style=flat-square&logo=googlechrome&logoColor=white" alt="Manifest V3"></a>
  <a href="https://isocpp.org/"><img src="https://img.shields.io/badge/C%2B%2B-17-00599C.svg?style=flat-square&logo=c%2B%2B&logoColor=white" alt="C++17"></a>
  <a href="https://discord.com"><img src="https://img.shields.io/badge/Discord-Rich%20Presence-5865F2.svg?style=flat-square&logo=discord&logoColor=white" alt="Discord RPC"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License"></a>
</p>

---

## Описание

WebRPC состоит из браузерного расширения и фонового C++ клиента. Расширение считывает текущую вкладку (видео на YouTube, треки в Spotify, стримы на Twitch, страницы GitHub и т.д.) и передает данные клиенту через WebSocket, который затем обновляет ваш статус в Discord.

## Скриншоты

| Расширение | Статус в Discord |
| :---: | :---: |
| ![Extension](docs/extension_preview.png) | ![Discord Status](docs/discord_preview.png) |

---

## Особенности

- **Поддержка медиаплееров:** Автоматически показывает название видео или трека, статус воспроизведения (Play/Pause) и таймкоды (YouTube, Twitch, Netflix, Spotify и др.).
- **Поддержка веб-сайтов:** Отображает сайт и его логотип (GitHub, Reddit, Twitter/X и др.).
- **Настройки приватности:** Можно скрыть название страницы, отключить кнопки или выбрать стиль иконок в меню расширения.
- **Низкое потребление ресурсов:** Фоновый C++ клиент работает в системном трее и потребляет минимум памяти.

---

## Установка и запуск

### 1. Запуск C++ клиента
1. Убедитесь, что десктопный Discord запущен.
2. Запустите `webRPC.exe`.

*Сборка из исходников (опционально):*
```bash
cd "client src"
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

### 2. Установка расширения
1. Откройте `chrome://extensions/` в браузере.
2. Включите **Режим разработчика** (вверху справа).
3. Нажмите **Загрузить распакованное расширение** и выберите папку `extension`.

---

## Решение проблем

- **Статус не появляется в Discord:** Убедитесь, что запущен десктопный Discord и в его настройках (*Конфиденциальность активности*) включена опция *«Отображать текущую активность в статусе»*.
- **Расширение показывает Disconnected:** Проверьте, запущен ли `webRPC.exe` (клиент использует локальный порт `8765` - убедитесь что не занят либо смените в настройках.).

---

## Лицензия
Проект полностью опенсурс.
[GNU GPL-3.0](LICENSE)
