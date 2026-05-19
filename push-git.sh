#!/bin/bash

# Script tự động git add, commit, push và tạo nhánh mới

# Hàm hiển thị loading animation
show_loading() {
    local message="$1"
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    while true; do
        i=$(((i + 1) % 10))
        printf "\r%s %s" "$message" "${spin:$i:1}"
        sleep 0.1
    done
}

# Hàm chạy command với loading
run_with_loading() {
    local message="$1"
    shift
    local cmd="$@"
    
    show_loading "$message" &
    local loading_pid=$!
    
    eval "$cmd" > /dev/null 2>&1
    local exit_code=$?
    
    kill $loading_pid 2>/dev/null
    wait $loading_pid 2>/dev/null
    
    printf "\r%s" "$message"
    if [ $exit_code -eq 0 ]; then
        echo " ✅"
    else
        echo " ❌"
        return $exit_code
    fi
}

# Hàm hiển thị menu
show_menu() {
    echo "=========================================="
    echo "  Git Auto Push Script"
    echo "=========================================="
    echo "1. Add, Commit và Push (nhánh hiện tại)"
    echo "2. Tạo nhánh mới, Add, Commit và Push"
    echo "3. Thoát"
    echo "=========================================="
    read -p "Chọn tùy chọn (1-3): " choice
}

# Hàm git fetch và pull (helper function)
fetch_and_pull() {
    echo ""
    echo "📥 Đang đồng bộ code mới nhất từ remote..."
    echo ""
    
    run_with_loading "📥 Đang fetch từ remote..." "git fetch"
    run_with_loading "⬇️  Đang pull từ remote..." "git pull"
    
    echo ""
}

# Hàm add, commit, push trên nhánh hiện tại
push_current_branch() {
    read -p "Nhập commit message (mặc định: 'update'): " message
    message=${message:-"update"}
    
    now="$(date +'%Y-%m-%d %H:%M:%S')"
    full_message="$message $now"
    
    # Fetch và pull code mới nhất trước khi push
    fetch_and_pull
    
    echo ""
    echo "🔄 Bắt đầu quá trình add, commit và push..."
    echo ""
    
    run_with_loading "📦 Đang add files..." "git add ."
    run_with_loading "💾 Đang commit..." "git commit -m \"$full_message\""
    run_with_loading "🚀 Đang push..." "git push"
    
    echo ""
    echo "✅ Hoàn thành!"
    echo ""
}

# Hàm tạo nhánh mới, add, commit, push
create_branch_and_push() {
    read -p "Nhập tên nhánh mới: " branch_name
    
    if [ -z "$branch_name" ]; then
        echo "❌ Tên nhánh không được để trống!"
        return 1
    fi
    
    read -p "Nhập commit message (mặc định: 'new'): " message
    message=${message:-"new"}
    
    now="$(date +'%Y-%m-%d %H:%M:%S')"
    full_message="$message $now"
    
    # Fetch và pull code mới nhất trước khi push
    fetch_and_pull
    
    echo ""
    echo "🔄 Bắt đầu quá trình tạo nhánh, add, commit và push..."
    echo ""
    
    run_with_loading "🌿 Đang tạo và chuyển sang nhánh mới: $branch_name" "git checkout -b \"$branch_name\""
    run_with_loading "📦 Đang add files..." "git add ."
    run_with_loading "💾 Đang commit..." "git commit -m \"$full_message\""
    run_with_loading "🚀 Đang push và set upstream..." "git push -u origin \"$branch_name\""
    
    echo ""
    echo "✅ Đã tạo nhánh $branch_name và push thành công!"
    echo ""
}

# Menu chính
while true; do
    show_menu
    
    case $choice in
        1)
            push_current_branch
            break
            ;;
        2)
            create_branch_and_push
            break
            ;;
        3)
            echo "👋 Thoát script"
            exit 0
            ;;
        *)
            echo "❌ Lựa chọn không hợp lệ! Vui lòng chọn 1-3"
            sleep 1
            ;;
    esac
done
