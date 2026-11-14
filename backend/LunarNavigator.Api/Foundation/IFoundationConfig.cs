using LunarNavigator.Api.Contracts;

namespace LunarNavigator.Api.Foundation;

public interface IFoundationConfig
{
    /// <summary>Gets the configured region, analysis limits and available features.</summary>
    ConfigResponse Get();
}
