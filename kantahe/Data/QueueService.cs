using Microsoft.Extensions.Configuration;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace kantahe.Data
{
    public class QueueService
    {
        private Random rnd = new Random();

        public async Task Play()
        {
            if (State.Status != PlayState.Playing)
            {
                var song = GetSongInQueue();
                if (song != null)
                {
                    PlaySong(song);
                }
            }
        }
        public async Task Stop(bool continueNextSong = true)
        {
            State.ContinueNextSong = continueNextSong;
            if (State.Status != PlayState.Stopped)
            {
                StopSong();
            }
        }
        public async Task NextSong()
        {
            Stop(true);
        }
        private void PlaySong(Song song)
        {
            State.Status = PlayState.Playing;
            ProcessStartInfo psi = new ProcessStartInfo(State.VLCPath);
            psi.Arguments = $"--fullscreen --play-and-exit --no-video-title \"{song.Filename}\"";
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;            
            var p = Process.Start(psi);
            p.EnableRaisingEvents = true;
            p.Exited += (o, e) =>
            {
                State.Status = PlayState.Stopped;                
                if (State.ContinueNextSong)
                {
                    if (!State.IsPlayingRandom)
                    {
                        RemoveTopMostSong();
                    }                    
                    _ = Play();
                }
            };
            State.Status = PlayState.Playing;
        }
        private void StopSong()
        {
            ProcessStartInfo psi = new ProcessStartInfo(State.VLCPath);
            psi.Arguments = $"vlc://quit";
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            var p = Process.Start(psi);
            p.WaitForExit();
            State.Status = PlayState.Stopped;
        }
        private void RemoveTopMostSong()
        {
            if (State.Queue.Count > 0)
            {
                State.Queue.RemoveAt(0);
            }
        }
        private Song GetSongInQueue()
        {
            if (State.Queue.Count > 0)
            {
                State.IsPlayingRandom = false;
                return State.Queue[0];
            }
            State.IsPlayingRandom = true;
            return State.Songs[rnd.Next(State.Songs.Count)];
        }
    }
}
