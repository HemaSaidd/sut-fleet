@echo off
title UniFleet Safety - تشغيل منظومة سلامة حافلات جامعة السويدي للتكنولوجيا (SUT)
echo ======================================================================
echo   UniFleet Safety - منظومة الرقابة التشاركية لسلامة أسطول الجامعة
echo   Elsewedy University of Technology (SUT) - Live Operations Server
echo ======================================================================
echo.
echo جاري تشغيل خادم البث المباشر وقاعدة البيانات...
echo.
start http://localhost:8080/index.html?view=operations-center
python server.py
pause
