# -*- coding: utf-8 -*-
"""
MẪU CODE PYTHON (Desktop App, Tool Auto, Bot, PyQt, Tkinter)
Dùng để xác thực API Key và khóa theo mã máy (HWID)
"""

import requests
import uuid
import platform
import hashlib

# Cấu hình địa chỉ Server Key của bạn
SERVER_URL = "http://localhost:3000/api/v1/verify"

def get_hwid():
    """
    Sinh mã định danh duy nhất (HWID) dựa trên UUID và tên máy
    """
    node = str(uuid.getnode())
    machine_name = platform.node()
    raw = f"{node}_{machine_name}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24].upper()

def verify_license(api_key):
    """
    Gửi request kiểm tra bản quyền lên server
    """
    hwid = get_hwid()
    payload = {
        "apiKey": api_key.strip(),
        "hwid": hwid
    }

    try:
        response = requests.post(SERVER_URL, json=payload, timeout=8)
        data = response.json()

        if response.status_code == 200 and data.get("valid"):
            name = data.get("name", "Người dùng")
            days = data.get("daysRemaining")
            lifetime = data.get("isLifetime")

            print("\n" + "="*45)
            print(" [OK] XÁC THỰC BẢN QUYỀN THÀNH CÔNG!")
            print(f" * Khách hàng : {name}")
            if lifetime:
                print(" * Thời hạn   : VĨNH VIỄN (Lifetime)")
            else:
                print(f" * Thời hạn   : Còn {days} ngày")
            print(f" * Mã máy HWID: {hwid}")
            print("="*45 + "\n")
            return True, data
        else:
            err_msg = data.get("message", "Key không hợp lệ")
            print("\n" + "!"*45)
            print(f" [LỖI] Kích hoạt thất bại: {err_msg}")
            print(f" * Mã máy của bạn: {hwid}")
            print("!"*45 + "\n")
            return False, data

    except requests.exceptions.ConnectionError:
        print("\n[LỖI] Không thể kết nối tới Server Key. Vui lòng kiểm tra lại mạng hoặc server!")
        return False, None
    except Exception as e:
        print(f"\n[LỖI NGOẠI LỆ] {e}")
        return False, None

if __name__ == "__main__":
    user_key = input("Nhập API Key của bạn: ").strip()
    is_valid, _ = verify_license(user_key)

    if is_valid:
        print("--> Đang khởi động các chức năng VIP của App...")
        # TODO: Viết logic code chính của app ở đây
    else:
        print("--> Ứng dụng sẽ đóng vì chưa có bản quyền.")
