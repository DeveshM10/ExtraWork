<?php
/**
 * Contact-form endpoint for the static Print Media Online site.
 *
 * Replaces the Elementor Pro / WPForms submission handler that the original
 * WordPress build relied on. Drop this file at the site root on any PHP host
 * and assets/js/form-handler.js will post to it.
 *
 * CONFIGURE: $TO below, and (if your host requires it) $FROM.
 */

declare(strict_types=1);

$TO      = 'order@printmediaonline.com';
$FROM     = 'website@printmediaonline.com';   // must usually be a mailbox on this domain
$SUBJECT  = 'Website enquiry - Print Media Online';

header('Content-Type: application/json; charset=utf-8');

function reply(bool $ok, string $message, int $code = 200): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(false, 'Method not allowed.', 405);
}

/** Collect the Elementor-style form_fields[...] inputs. */
$fields = [];
foreach ($_POST as $key => $value) {
    if (preg_match('/^form_fields\[(.+)\]$/', $key, $m)) {
        $fields[$m[1]] = is_string($value) ? trim($value) : '';
    }
}
// Some servers parse form_fields[name] into a real array instead.
if (isset($_POST['form_fields']) && is_array($_POST['form_fields'])) {
    foreach ($_POST['form_fields'] as $k => $v) {
        $fields[$k] = is_string($v) ? trim($v) : '';
    }
}

$labels = [
    'name'          => 'Name',
    'email'         => 'Email',
    'field_6491f70' => 'Service',
    'message'       => 'Message',
];

$email = $fields['email'] ?? '';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(false, 'Please enter a valid email address.', 422);
}

// Reject header-injection attempts in any single-line value.
foreach ($fields as $k => $v) {
    if ($k !== 'message' && preg_match('/[\r\n]/', $v)) {
        reply(false, 'Invalid input.', 422);
    }
}

// Very light spam brake: require something to actually have been said.
if (($fields['message'] ?? '') === '' && ($fields['name'] ?? '') === '') {
    reply(false, 'Please add a message so we know what you need.', 422);
}

$lines = [];
foreach ($labels as $key => $label) {
    if (!empty($fields[$key])) {
        $lines[] = $label . ': ' . $fields[$key];
    }
}
$lines[] = '';
$lines[] = '---';
$lines[] = 'Sent from the website contact form on ' . date('Y-m-d H:i:s');
$lines[] = 'Visitor IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');

$body = implode("\n", $lines);

$headers = [
    'From: Print Media Online Website <' . $FROM . '>',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
];

$sent = @mail($TO, $SUBJECT, $body, implode("\r\n", $headers));

if (!$sent) {
    // Keep a local copy so an enquiry is never silently lost if mail() is
    // unavailable or the host blocks it.
    @file_put_contents(
        __DIR__ . '/contact-submissions.log',
        "==== " . date('c') . " ====\n" . $body . "\n\n",
        FILE_APPEND | LOCK_EX
    );
    reply(false, 'We could not send your message right now. Please email ' . $TO . ' directly.', 500);
}

reply(true, 'Thanks - your message has been sent. We will be in touch shortly.');
