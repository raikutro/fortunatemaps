<?php
header('Content-Type: text/plain;charset=UTF-8');
function user_agent($address)
{
 return ($curl = curl_init($address))
  && curl_setopt($curl, CURLOPT_USERAGENT, 'RondingTagProMapEditor/1.0 (+http://map-editor.tagpro.eu)')
  && curl_setopt($curl, CURLOPT_RETURNTRANSFER, true)
  ? $curl : false;
}
function upload_map($address, $logic, $layout, $play)
{
 global $clouds;
 $sys = sys_get_temp_dir();
 ignore_user_abort();
 $json = tempnam($sys, 'mj');
 $png = tempnam($sys, 'mp');
 file_put_contents($json, $_POST['logic']);
 file_put_contents($png, base64_decode($_POST['layout']));
 if(($curl = user_agent($address))
  && curl_setopt($curl, CURLOPT_POST, true)
  && curl_setopt($curl, CURLOPT_POSTFIELDS, array(
  $logic => new CURLFile($json, 'application/json', 'map.json'),
  $layout => new CURLFile($png, 'image/png', 'map.png'))))
 {
  if($play)
  {
   if(curl_exec($curl) !== false && ($result = curl_getinfo($curl, CURLINFO_REDIRECT_URL)) !== false)
    echo $result;
  }
  else
  {
   if(($result = curl_exec($curl)) !== false && ($result = json_decode($result)) && $result->success)
    // echo isset($result->saveurl) ? $result->saveurl : $result->url;
    echo 'http://', $clouds[$_POST['cloud']], isset($result->saveurl) ? $result->saveurl : $result->url;
  }
 }
 unlink($json);
 unlink($png);
}
if (strlen($argv[1]) > 0)
  $_POST['logic'] = $argv[1];
if (strlen($argv[2]) > 0)
  $_POST['layout'] = $argv[2];
if (strlen($argv[3]) > 0)
  $_POST['server'] = $argv[3];
if (strlen($argv[4]) > 0)
  $_POST['url'] = $argv[4];
if (strlen($argv[5]) > 0)
  $_POST['cloud'] = $argv[5];

if(isset($_POST['logic']) && isset($_POST['layout']))
{
 $servers = array(
  'maptest.newcompte.fr',
  'maptest2.newcompte.fr',
  'maptest3.newcompte.fr',
  'oceanic.newcompte.fr');
 $clouds = array(
  'maps.jukejuice.com',
  'unfortunate-maps.jukejuice.com');

 if(isset($_POST['server']) && isset($servers[$_POST['server']]))
  upload_map('http://' . $servers[$_POST['server']] . '/testmap', 'logic', 'layout', true);
 elseif(isset($_POST['cloud']) && isset($clouds[$_POST['cloud']]))
  upload_map('http://' . $clouds[$_POST['cloud']] . '/upload', 'file[0]', 'file[1]', false);
}
elseif(isset($_POST['url']) && preg_match('#^\s*(?:http://)?((?:unfortunate-)?maps\.jukejuice\.com)/(?:show|static/previews)/(\d+)(?:\.png)?\s*$#', $_POST['url'], $matches))
{
 if(($curl = user_agent('http://' . $matches[1] . '/download?mapname=map&type=json&mapid=' . $matches[2]))
  && ($json = curl_exec($curl)) !== false
  && ($curl = user_agent('http://' . $matches[1] . '/download?mapname=map&type=png&mapid=' . $matches[2]))
  && ($png = curl_exec($curl)) !== false)
  echo json_encode(array('logic' => $json, 'layout' => base64_encode($png)));
}
?>
