using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace kantahe.Data
{
    public class State
    {
        public static List<Song> Songs { get; set; }
        public static ObservableCollection<Song> Queue { get; set; }
        public static PlayState Status { get; set; }
        public static string VLCPath { get; set; }
        public static bool ContinueNextSong { get; set; }
    }

    public enum PlayState
    {
        Stopped,
        Playing
    }
}
