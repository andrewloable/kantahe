Kantahe is a self-hosted karaoke server: one program with its web app inside. Upload your own `.kar` and `.karmp3` songs,
sign in with email and password, and sing from a browser, a phone or a TV. Kantahe ships no songs.

## Download

One file per system, named `kantahe-VERSION-OS-ARCH` (Windows files end in `.exe`), for Linux, macOS and Windows on amd64
and arm64. `SHA256SUMS` lists the checksum of each file; check the file you download against it.

A multi-arch Docker image is on ghcr.io: `ghcr.io/andrewloable/kantahe`.

## Run it

Start the file you downloaded; it listens on port 8080 and creates its data folder. Open `http://localhost:8080` and
create the first account there, which becomes the administrator. The installation guide covers the data and library
folders, the Docker image, services and a reverse proxy:
https://github.com/andrewloable/kantahe/blob/master/docs/install.md
