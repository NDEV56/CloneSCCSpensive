@echo off
echo ========================================================
echo Sinkronisasi File Web ke Android Assets (SMP Masyithoh)
echo ========================================================
copy /Y "index.html" "android\app\src\main\assets\index.html"
copy /Y "style.css" "android\app\src\main\assets\style.css"
copy /Y "index.js" "android\app\src\main\assets\index.js"
copy /Y "firebase-init.js" "android\app\src\main\assets\firebase-init.js"
xcopy /E /I /Y "assets" "android\app\src\main\assets\assets"
copy /Y "assets\logo.png" "android\app\src\main\res\drawable\ic_launcher.png"
echo.
echo [SUKSES] Semua file web berhasil disinkronkan ke Android Studio!
pause
