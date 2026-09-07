#!/usr/bin/env python3
"""index.html から アーティファクト用の断片を起こす。

アーティファクトは <!doctype>…<head>…<body> を向こうが被せるので、
こちらは中身だけを渡す。明朝は端末に無いことがあるので Noto Serif JP を足す。
"""
import io, re

src = io.open('/home/user/sushitsumu/index.html', encoding='utf-8').read()

body = src
body = body[body.index('<title>'):]                       # DOCTYPE / html / head の meta を落とす
body = body[:body.rindex('</script>') + len('</script>')]  # </body></html> を落とす
body = body.replace('<body>\n', '').replace('</body>', '')
# 広告SDKの貼り方を書いた覚書は、アーティファクトでは使わないので落とす
body = re.sub(r'\n<!-- =+\n     ポータルに載せる時だけ.*?-->\n', '\n', body, flags=re.S)

out = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2'
       '?family=Noto+Serif+JP:wght@400;500;600;700&display=swap">\n' + body + '\n')

assert '<!DOCTYPE' not in out and '<html' not in out and '</html>' not in out
assert '<body' not in out and '</body>' not in out
assert out.count('<title>') == 1

io.open('/home/user/sushitsumu/artifact/sushitsumu.html', 'w', encoding='utf-8').write(out)
print('artifact/sushitsumu.html', len(out.encode('utf-8')), 'bytes')
