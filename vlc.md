You’re dealing with two separate VLC problems at once: recording audio missing, and playback/decoder compatibility. I’ll give you a quick fix path for both so you can get reliable camera recordings with video + sound and avoid the mp4a playback complaint.

This sounds like a combo of 1) recording config issue and 2) playback codec compatibility issue.

1. **Why Media Player complains about `mp4a`**
- `mp4a` is usually **AAC audio** in an MP4 file.
- Some Windows players/codecs (especially older Windows Media Player paths) choke on certain AAC variants.
- That’s why it plays in **Movies & TV** but not in another player.

2. **Fix recording in VLC so camera capture includes audio**
In VLC:
1. `Media` → `Open Capture Device`
2. Capture mode: `DirectShow`
3. Video device: your webcam
4. Audio device name: pick your mic/interface explicitly (not `Default` if possible)
5. Click the arrow next to `Play` → `Convert`
6. Profile: use `Video - H.264 + MP3 (MP4)` for maximum compatibility
   - If this profile isn’t there, create one:
   - Encapsulation: `MP4/MOV`
   - Video codec: `H-264`
   - Audio codec: `MP3` (instead of AAC/mp4a)
7. Save and record a 10-second test clip.

3. **If VLC plays audio but shows black/no video**
This is usually hardware decoding/output conflict:
1. `Tools` → `Preferences` (show `Simple`)
2. `Input / Codecs` → Hardware-accelerated decoding: set to `Disable`
3. `Video` → Output: set to `Direct3D11` (or `Automatic`; if bad, try `OpenGL`)
4. Save, fully close VLC, reopen, test playback again.

4. **If your existing file has video but “wrong” audio codec**
You can convert/remux it:
- `Media` → `Convert / Save` → add file → `Convert`
- Choose profile `H.264 + MP3 (MP4)`
- Start conversion
- This keeps it widely playable in Windows players.

5. **Quick sanity checks**
- Windows microphone permission enabled for desktop apps.
- Correct input device selected (USB mic often changes names/IDs after reconnect).
- Sample rate set to `48000 Hz` for both recording app and mic device (Windows sound settings).

If you want, I can give you a **known-good VLC preset** (exact codec bitrates/fps/audio settings) for webcam recording on Windows so this stops happening.