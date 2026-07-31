<?php
// ============ НАСТРОЙКИ ============
$DB_FILE = 'messages.json';
$USERS_FILE = 'users.json';

// ============ ФУНКЦИИ ============
function loadData($file) {
    if (!file_exists($file)) return [];
    $data = file_get_contents($file);
    return json_decode($data, true) ?: [];
}

function saveData($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getUser($username) {
    $users = loadData($GLOBALS['USERS_FILE']);
    foreach ($users as $user) {
        if ($user['username'] === $username) return $user;
    }
    return null;
}

// ============ ОБРАБОТКА ============
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$method = $_SERVER['REQUEST_METHOD'];

// ============ GET ============
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    $user = $_GET['user'] ?? '';
    
    if ($action === 'get') {
        $messages = loadData($DB_FILE);
        $messages = array_slice($messages, -100);
        echo json_encode(['success' => true, 'messages' => $messages]);
        exit;
    }
    
    if ($action === 'check_call') {
        $calls = loadData('calls.json');
        if (isset($calls[$user])) {
            echo json_encode(['success' => true, 'answer' => $calls[$user]]);
            unset($calls[$user]);
            saveData('calls.json', $calls);
        } else {
            echo json_encode(['success' => false]);
        }
        exit;
    }
}

// ============ POST ============
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    // РЕГИСТРАЦИЯ
    if ($action === 'register') {
        $username = trim($input['username'] ?? '');
        $password = trim($input['password'] ?? '');
        
        if (strlen($username) < 2) {
            echo json_encode(['success' => false, 'error' => 'Имя слишком короткое']);
            exit;
        }
        if (strlen($password) < 4) {
            echo json_encode(['success' => false, 'error' => 'Пароль слишком короткий (мин. 4 символа)']);
            exit;
        }
        
        $users = loadData($USERS_FILE);
        foreach ($users as $u) {
            if ($u['username'] === $username) {
                echo json_encode(['success' => false, 'error' => 'Пользователь уже существует']);
                exit;
            }
        }
        
        $users[] = [
            'username' => $username,
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'created_at' => date('Y-m-d H:i:s')
        ];
        saveData($USERS_FILE, $users);
        
        echo json_encode(['success' => true]);
        exit;
    }
    
    // ВХОД
    if ($action === 'login') {
        $username = trim($input['username'] ?? '');
        $password = trim($input['password'] ?? '');
        
        $user = getUser($username);
        if (!$user || !password_verify($password, $user['password'])) {
            echo json_encode(['success' => false, 'error' => 'Неверное имя или пароль']);
            exit;
        }
        
        echo json_encode(['success' => true, 'user' => $username]);
        exit;
    }
    
    // ОТПРАВКА
    if ($action === 'send') {
        $username = trim($input['username'] ?? '');
        $message = trim($input['message'] ?? '');
        
        if (!$username || !$message) {
            echo json_encode(['success' => false, 'error' => 'Пустое сообщение']);
            exit;
        }
        
        $messages = loadData($DB_FILE);
        $messages[] = [
            'username' => $username,
            'message' => $message,
            'created_at' => date('Y-m-d H:i:s')
        ];
        saveData($DB_FILE, $messages);
        
        echo json_encode(['success' => true]);
        exit;
    }
    
    // ЗВОНОК
    if ($action === 'call') {
        $username = trim($input['username'] ?? '');
        $offer = $input['offer'] ?? '';
        
        if (!$username || !$offer) {
            echo json_encode(['success' => false]);
            exit;
        }
        
        $calls = loadData('calls.json');
        $calls[$username] = $offer;
        saveData('calls.json', $calls);
        
        echo json_encode(['success' => true]);
        exit;
    }
}

echo json_encode(['success' => false, 'error' => 'Неизвестный запрос']);
