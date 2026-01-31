# Резервные копии иконки для маркета (512×512)

Здесь хранятся копии иконки `icon_launcher_foreground_512.png` для Google Play.

- **icon_launcher_foreground_512_current.png** — текущая версия в приложении (сжатая, &lt;1 MB).

Перед следующей заменой иконки в `android/app/src/main/res/` скопируйте туда старую версию сюда, например:

```bash
cp android/app/src/main/res/icon_launcher_foreground_512.png icon_backup/icon_launcher_foreground_512_YYYY-MM-DD.png
```

Папка `icon_backup/` не входит в сборку Android и используется только для хранения резервных файлов.
