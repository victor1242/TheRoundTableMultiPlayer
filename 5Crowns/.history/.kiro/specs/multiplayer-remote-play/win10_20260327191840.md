Good plan. Enjoy supper!

When you come back, the logical first steps on the desktop machine are:

Install VS Code and open the 5Crowns project folder
Install Node.js LTS from nodejs.org
Clone or copy the project to the desktop (easiest: push to GitHub from your current machine, pull on the desktop)
Run npm install to get dependencies
Test the game locally on that machine first (debug-server.js)
Then proceed with Phase 6 of the multiplayer plan (PM2, static IP, port forward, etc.)
Getting the game working locally on the desktop first — before adding the server layer — is the right order. That way you know your baseline is solid before exposing it to the network.

See you when you're back!

Claude Sonnet 4.6 • 0.9x