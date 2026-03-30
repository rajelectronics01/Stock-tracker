@echo off
npx -y create-next-app@latest temp-app --typescript --no-tailwind --eslint --app --src-dir --import-alias="@/*" --use-npm
xcopy /E /I /H /Y temp-app .
rmdir /S /Q temp-app
