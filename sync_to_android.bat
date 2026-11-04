@echo off
echo ========================================================
echo Sinkronisasi File Web ke Android Assets (SMP Masyithoh)
echo ========================================================
copy /Y "index.html" "android\app\src\main\assets\index.html"
copy /Y "style.css" "android\app\src\main\assets\style.css"
copy /Y "index.js" "android\app\src\main\assets\index.js"
copy /Y "supabase-config.js" "android\app\src\main\assets\supabase-config.js"
copy /Y "supabase-init.js" "android\app\src\main\assets\supabase-init.js"
xcopy /E /I /Y "assets" "android\app\src\main\assets\assets"
echo.
echo Catatan: ikon launcher android\app\src\main\res\drawable\ic_launcher.png
echo dikelola terpisah agar tidak menimpa ikon yang sudah di-resize.
echo.
echo [SUKSES] Semua file web berhasil disinkronkan ke Android Studio!
pause
