using Microsoft.Extensions.Configuration;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace kantahe.Data
{
    public class SongService
    {
        private IConfiguration _config;
        public SongService(IConfiguration config)
        {
            _config = config;
        }
        public Task<List<Song>> GetAllSongsAsync()
        {
            var jsonFilename = _config["PlaylistFilename"];
            var json = File.ReadAllText(jsonFilename);
            var folder = Path.GetDirectoryName(jsonFilename);
            var list = JArray.Parse(json);
            var songs = new List<Song>();
            foreach(var o in list)
            {
                var exist = songs.FirstOrDefault(r => r.ID == o["ID"].ToString());
                if (exist == null)
                {
                    var fn = Path.Combine(folder, o["FileName"].ToString());
                    if (File.Exists(fn))
                    {
                        songs.Add(new Song()
                        {
                            Artist = o["Artist"].ToString().Trim().ToUpper(),
                            Title = o["Title"].ToString().Trim().ToUpper(),
                            ID = o["ID"].ToString(),
                            Filename = fn
                        });
                    }                    
                }                
            }
            return Task.FromResult(songs);
        }
    }
}
