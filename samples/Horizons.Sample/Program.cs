using System.Text.Json;
using ByteForce.Horizons;
using ByteForce.Models;

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
IHorizonsClient horizons = new HorizonsClient(http);
var site = new LunarObserver(latitudeDegrees: -89.5, longitudeDegreesEast: 0, altitudeKilometers: 0);
var time = new DateTimeOffset(2026, 11, 13, 0, 0, 0, TimeSpan.Zero).AddMilliseconds(123);
var observation = await horizons.GetObservationAsync(site, time);
Console.WriteLine(JsonSerializer.Serialize(observation, new JsonSerializerOptions { WriteIndented = true }));
