import hashlib
import json
import pathlib
import zipfile

base = pathlib.Path(__file__).resolve().parent.parent
version = json.loads((base / 'package.json').read_text(encoding='utf-8'))['version']
for edition in ('Up-To-Date', 'Pure-Desktop'):
    folder = base / 'release' / f'System-Builder-{edition}-v{version}'
    output = folder.parent / (folder.name + '.zip')
    files = sorted(file for file in folder.rglob('*') if file.is_file())
    if not output.exists():
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for file in files:
                archive.write(file, file.relative_to(folder.parent).as_posix())
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None, 'ZIP integrity check failed'
        assert sorted(archive.namelist()) == sorted(file.relative_to(folder.parent).as_posix() for file in files)
        for file in files:
            assert archive.read(file.relative_to(folder.parent).as_posix()) == file.read_bytes(), 'ZIP differs from the tested package'
        prefix = folder.name + '/'
        assert prefix + 'System Builder.exe' in archive.namelist()
        assert archive.read(prefix + 'resources/app/desktop/system-builder.ico') == (base / 'desktop/system-builder.ico').read_bytes()
        seed = json.loads(archive.read(prefix + 'resources/app/desktop/seed.json'))
        if edition == 'Pure-Desktop':
            assert all(not rows for rows in seed['collections'].values())
            assert not seed.get('desktopPreferences')
            assert prefix + 'resources/app/desktop/backup.cjs' not in archive.namelist()
            assert prefix + 'resources/app/firebase-applet-config.json' not in archive.namelist()
            main = archive.read(prefix + 'resources/app/desktop/main.cjs').decode()
            preload = archive.read(prefix + 'resources/app/desktop/preload.cjs').decode()
            assert "database:backup" not in main and "database:backup" not in preload
            assert "database:export" not in main and "database:export" not in preload
        else:
            assert seed == json.loads((base / 'desktop/seed.json').read_text(encoding='utf-8'))
    with output.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    print(json.dumps({'file': str(output), 'bytes': output.stat().st_size, 'sha256': digest, 'verified': True}), flush=True)

