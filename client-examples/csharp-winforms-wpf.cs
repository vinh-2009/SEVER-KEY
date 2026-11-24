// =========================================================================
// MẪU CODE C# (.NET / WinForms / WPF / Console App)
// Dùng để kiểm tra bản quyền API Key khi mở ứng dụng Windows
// =========================================================================

using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Management; // Lưu ý: Thêm tham chiếu 'System.Management' trong References/NuGet

namespace AppKeyVerification
{
    public class KeyCheckResult
    {
        public bool IsValid { get; set; }
        public string Message { get; set; }
        public string ClientName { get; set; }
        public int? DaysRemaining { get; set; }
    }

    public static class LicenseValidator
    {
        // Thay địa chỉ IP/Domain của Server của bạn (nếu chạy local thì để localhost:3000)
        private const string SERVER_BASE_URL = "http://localhost:3000";
        private static readonly HttpClient httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

        /// <summary>
        /// Lấy mã máy (HWID) duy nhất của thiết bị Windows (CPU ID + Motherboard UUID)
        /// </summary>
        public static string GetHardwareId()
        {
            try
            {
                string cpuId = "";
                using (var mc = new ManagementClass("Win32_Processor"))
                {
                    foreach (ManagementObject mo in mc.GetInstances())
                    {
                        cpuId = mo.Properties["ProcessorId"]?.Value?.ToString() ?? "";
                        break;
                    }
                }

                string boardId = "";
                using (var mc = new ManagementClass("Win32_BaseBoard"))
                {
                    foreach (ManagementObject mo in mc.GetInstances())
                    {
                        boardId = mo.Properties["SerialNumber"]?.Value?.ToString() ?? "";
                        break;
                    }
                }

                string combined = $"{cpuId}_{boardId}_{Environment.MachineName}";
                using (var sha = System.Security.Cryptography.SHA256.Create())
                {
                    byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(combined));
                    return BitConverter.ToString(bytes).Replace("-", "").Substring(0, 24);
                }
            }
            catch
            {
                // Fallback nếu không có quyền WMI
                return Environment.MachineName + "_" + Environment.UserName;
            }
        }

        /// <summary>
        /// Gọi server xác thực API Key
        /// </summary>
        public static async Task<KeyCheckResult> VerifyKeyAsync(string apiKey)
        {
            try
            {
                string hwid = GetHardwareId();
                var payload = new
                {
                    apiKey = apiKey.Trim(),
                    hwid = hwid
                };

                string jsonContent = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var response = await httpClient.PostAsync($"{SERVER_BASE_URL}/api/v1/verify", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                using (var doc = JsonDocument.Parse(responseBody))
                {
                    var root = doc.RootElement;
                    bool valid = root.TryGetProperty("valid", out var validProp) && validProp.GetBoolean();

                    if (valid)
                    {
                        string name = root.TryGetProperty("name", out var n) ? n.GetString() : "User";
                        int? days = root.TryGetProperty("daysRemaining", out var d) && d.ValueKind != JsonValueKind.Null ? d.GetInt32() : (int?)null;

                        return new KeyCheckResult
                        {
                            IsValid = true,
                            ClientName = name,
                            DaysRemaining = days,
                            Message = days.HasValue ? $"Bản quyền hợp lệ! Còn {days} ngày" : "Bản quyền Vĩnh viễn!"
                        };
                    }
                    else
                    {
                        string errMsg = root.TryGetProperty("message", out var m) ? m.GetString() : "Key không hợp lệ";
                        return new KeyCheckResult { IsValid = false, Message = errMsg };
                    }
                }
            }
            catch (Exception ex)
            {
                return new KeyCheckResult { IsValid = false, Message = "Lỗi kết nối máy chủ: " + ex.Message };
            }
        }
    }

    // Ví dụ sử dụng trong hàm Main hoặc Form_Load:
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.Write("Nhập API Key bản quyền của bạn: ");
            string key = Console.ReadLine();

            Console.WriteLine("Đang kiểm tra với server...");
            var result = await LicenseValidator.VerifyKeyAsync(key);

            if (result.IsValid)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"[THÀNH CÔNG] Xin chào: {result.ClientName}!");
                Console.WriteLine(result.Message);
                Console.ResetColor();

                Console.WriteLine("--> Mở ứng dụng chính...");
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"[TỪ CHỐI] {result.Message}");
                Console.ResetColor();
                Console.WriteLine("Vui lòng liên hệ Admin để mua hoặc kích hoạt lại key.");
            }

            Console.ReadLine();
        }
    }
}
