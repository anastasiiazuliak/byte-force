using LunarNavigator.Api.Contracts;

namespace LunarNavigator.Api.Foundation;

public interface ILandingSiteCatalog
{
    /// <summary>Gets valid catalog entries. Cancellation retains its standard .NET exception type.</summary>
    Task<IReadOnlyList<LandingSite>> GetAsync(CancellationToken cancellationToken = default);
}
