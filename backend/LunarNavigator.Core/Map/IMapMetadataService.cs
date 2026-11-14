namespace LunarNavigator.Core.Map;

public interface IMapMetadataService
{
    Task<MapMetadata> GetAsync(CancellationToken cancellationToken = default);
}
