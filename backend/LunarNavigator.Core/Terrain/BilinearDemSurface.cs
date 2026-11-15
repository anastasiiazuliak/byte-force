namespace LunarNavigator.Core.Terrain;

/// <summary>Continuous, cell-center DEM model shared by observer and horizon sampling; never extrapolates.</summary>
public static class BilinearDemSurface
{
    public static bool TrySample(int columns, int rows, double column, double row,
        Func<int, int, float> readPixel, out double elevation)
    {
        elevation = double.NaN;
        if (columns <= 0 || rows <= 0 || !double.IsFinite(column) || !double.IsFinite(row) ||
            column < 0 || column > columns - 1 || row < 0 || row > rows - 1)
            return false;

        int c0 = (int)Math.Floor(column), r0 = (int)Math.Floor(row);
        int c1 = Math.Min(columns - 1, c0 + 1), r1 = Math.Min(rows - 1, r0 + 1);
        double fc = column - c0, fr = row - r0;
        double sum = 0;
        if (!Add(c0, r0, (1 - fc) * (1 - fr)) || !Add(c1, r0, fc * (1 - fr)) ||
            !Add(c0, r1, (1 - fc) * fr) || !Add(c1, r1, fc * fr))
            return false;
        elevation = sum;
        return true;

        bool Add(int c, int r, double weight)
        {
            // Zero-weight NoData neighbours do not invalidate an exact sample or edge.
            // Every positively weighted corner is required; never renormalize around gaps.
            if (weight == 0) return true;
            float value = readPixel(c, r);
            if (!float.IsFinite(value)) return false;
            sum += weight * value;
            return true;
        }
    }
}
