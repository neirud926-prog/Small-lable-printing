@echo off
:: OPEN-KIOSK.bat — Opens the Small Label app in Chrome with silent printing
:: Chrome will print directly to the default printer without showing a dialog.
::
:: SETUP:
::   1. Set your thermal printer as the default printer in Windows
::   2. Double-click this file to launch the app
::
:: If Chrome is installed in a non-standard location, update the path below.

set "APP=%~dp0dist\index.html"
set "CHROME1=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME2=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if exist "%CHROME1%" (
    start "" "%CHROME1%" --kiosk-printing "%APP%"
    goto :done
)
if exist "%CHROME2%" (
    start "" "%CHROME2%" --kiosk-printing "%APP%"
    goto :done
)

echo Chrome not found at default locations.
echo Please edit OPEN-KIOSK.bat and set the correct path.
pause

:done
