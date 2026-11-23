@echo off
javac -d build\classes src\main\java\com\mailboxgame\MailboxServer.java
if errorlevel 1 exit /b %errorlevel%
start http://localhost:8080
java -cp build\classes com.mailboxgame.MailboxServer
