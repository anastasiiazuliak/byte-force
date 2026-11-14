using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace LunarNavigator.Api.Tests.TestSupport;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Locate the API from the shared repository root, including shadow-copy test runs.
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "backend", "LunarNavigator.sln")))
            directory = directory.Parent;
        if (directory is null)
            throw new DirectoryNotFoundException("backend/LunarNavigator.sln was not found.");
        builder.UseContentRoot(Path.Combine(directory.FullName, "backend", "LunarNavigator.Api"));
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Api:AllowedOrigins:0"] = "http://localhost:5173",
            ["Api:MaxSamples"] = "1234"
        }));
    }
}
