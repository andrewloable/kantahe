using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;

namespace kantahe.Data
{
    public class Song : INotifyPropertyChanged
    {
        public string ID { get; set; }
        public string Filename { get; set; }
        public string Artist { get; set; }
        public string Title { get; set; }

        public event PropertyChangedEventHandler PropertyChanged;
    }
}
