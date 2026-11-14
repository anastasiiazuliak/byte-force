var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options => options.AddPolicy("Frontend", p => p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.UseCors("Frontend");
app.MapGet("/api/v1/health", () => Results.Ok(new {status = "ok", version = "0.1.0"}));
app.Run();
