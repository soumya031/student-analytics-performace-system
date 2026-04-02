import time
import psutil
import os

def calculate_s_time(T_opt, T_sub, alpha):
    if T_sub == 0:
        return 0.0 if T_opt > 0 else 1.0
    return min(1.0, (T_opt / T_sub)**alpha)

def calculate_s_space(M_opt, M_sub, beta):
    if M_sub == 0:
        return 0.0 if M_opt > 0 else 1.0
    return min(1.0, (M_opt / M_sub)**beta)

def calculate_overall_score(S_time, S_space, W_time, W_space):
    return (W_time * S_time) + (W_space * S_space)

def evaluate_user_code(user_function, T_opt, M_opt, alpha, beta, W_time, W_space):
    process = psutil.Process(os.getpid())

    start_time = time.perf_counter()
    result = user_function()
    end_time = time.perf_counter()

    memory_usage = process.memory_info().rss / (1024 * 1024)

    T_sub = end_time - start_time
    M_sub = memory_usage

    S_time = calculate_s_time(T_opt, T_sub, alpha)
    S_space = calculate_s_space(M_opt, M_sub, beta)
    OS = calculate_overall_score(S_time, S_space, W_time, W_space)

    return {
        "result": result,
        "time": T_sub,
        "memory": M_sub,
        "S_time": S_time,
        "S_space": S_space,
        "OS": OS
    }
