# Menambah coach baru

## Cara termudah: coach mengisi sendiri di `alvacy.com/join`

Kirim coach barunya satu link: `alvacy.com/join/?i=KODE-UNDANGAN` (kode undangan = nilai `JOIN_CODE` di Apps Script, bebas kamu pilih).

1. Coach mengisi nama, WhatsApp, email, warna, foto sebelum, sesudah, profil, angka, dan ceritanya. Fotonya dipotong langsung di halaman itu, dengan panduan oval kepala dan garis pinggang, jadi tidak perlu diedit dulu. Watermark #transformwithST dipasang otomatis.
2. Kamu dapat email berisi link review (cocok dibuka dari HP): foto, angka, dan cerita ditampilkan, lalu tinggal tekan **Setujui dan tayangkan** atau **Tolak**.
3. Setelah disetujui, Apps Script mengirim foto dan data ke GitHub dalam satu commit. GitHub Action membangun ulang halaman, dan dalam 3 sampai 5 menit coach tampil di carousel, link pribadinya `alvacy.com/kode` hidup, warnanya ikut, dan email lead langsung masuk ke emailnya (tanpa menyentuh `COACH_EMAILS`).
4. Coach mendapat email dengan **link edit** (`alvacy.com/join/?edit=...`). Lewat link itu dia bisa mengganti nomor WhatsApp, email, foto, angka, atau ceritanya kapan saja. Perubahan pada coach yang sudah tayang langsung terkirim ke website, dan kamu dapat email pemberitahuan.

Semua data coach ada di sheet **Coaches** (satu baris per coach). Kolom **Cerita (EN)** dan **Highlight (EN)** diterjemahkan otomatis saat disetujui. Kalau mau merapikan terjemahannya, ubah di sheet lalu pilih menu **Coaches > Publish ke website**. Untuk menyembunyikan coach, ubah kolom Status jadi `hidden`, lalu Publish.

### Pengaturan sekali saja

1. Di Google Sheet leads: Extensions > Apps Script. Ganti isi `Code.gs` dengan `apps-script/Code.gs` dari repo ini, lalu simpan.
2. Project Settings > Script properties, tambahkan:
   - `JOIN_CODE`: kode undangan yang kamu bagikan.
   - `GITHUB_TOKEN`: token GitHub (Settings > Developer settings > Fine-grained tokens). Pilih repo `ajthereal/alvacy` saja, izin **Contents: Read and write**.
3. Pilih fungsi `setupCoaches` di editor, tekan Run, dan setujui izin yang diminta (Drive, kirim email, koneksi ke luar, terjemahan). Hasilnya melaporkan apa yang masih kurang.
4. Deploy > Manage deployments > edit > Version: New version > Deploy. (Pakai deployment yang sama supaya alamat `/exec` tidak berubah.)
5. Yang dari kode `COACH_EMAILS` untuk 6 coach lama tetap berlaku. Coach baru lewat /join tidak perlu ditambahkan di sana.

### Hal teknis yang perlu diketahui

- Coach dari /join tidak ada di `assets/site.js` atau `assets/results.js`. Datanya ada di `data/coaches.js`, yang ditulis Apps Script dan dibaca `site.js` lewat `window.ALV_EXTRA`. Semua isi dibersihkan dulu, dan entri yang rusak dilewati tanpa merusak halaman. Coach di `site.js` selalu menang kalau kodenya sama.
- Setiap halaman yang memuat `site.js` harus memuat `<script src="/data/coaches.js"></script>` tepat sebelumnya.
- Apps Script menulis langsung ke branch `main`, jadi sebelum mengedit di komputer, jalankan `git pull --rebase origin main`.
- Link `alvacy.com/kode` langsung jalan lewat `404.html` begitu `data/coaches.js` terbit. Beberapa menit kemudian build menulis halaman redirect aslinya (supaya pratinjau WhatsApp punya nama coach).
- Foto di repo diberi nama `kode-after-<hash>.jpg`. Ganti foto berarti nama baru, jadi tidak ada masalah cache. File lama tetap tinggal di repo dan boleh dihapus sesekali.

## Cara manual (tanpa /join)

Halaman hasil ada di `alvacy.com/transform/`. Satu halaman ini dipakai semua coach. Warna, nama, nomor WhatsApp,
dan cerita pembuka berganti sesuai link coach-nya, misalnya `alvacy.com/transform/#lala`.

## Isi yang dibutuhkan dari tiap coach

1. Foto sebelum dan sesudah, pose dan jarak kira-kira sama (JPG, minimal 600 px lebar).
2. Angka awal dan akhir: berat (kg), lemak tubuh (%), lemak visceral (VFA).
3. Satu cerita pendek dengan kata-katanya sendiri.
4. Persetujuan coach bahwa fotonya tampil.
5. Untuk link pribadi: nomor WhatsApp, foto potret (opsional), dan pilihan warna. Kota boleh dikosongkan, dan di halaman ini memang tidak ditampilkan.

## Langkah

1. **Foto.** Dari file asli (bukan yang sudah diberi watermark):

       python3 scripts/prepare_photo.py ASLI-sebelum.jpg images/results/NAMA-before.jpg --corner left
       python3 scripts/prepare_photo.py ASLI-sesudah.jpg images/results/NAMA-after.jpg --corner right

   Skrip memotong ke 4:5, membatasi lebar 900 px, dan memasang watermark #transformwithST. Foto asli jangan disimpan di repo.

2. **Hasil.** Di `transform/index.html`, tambahkan satu blok di `const CASES`:

       {coach:'nama',name:'dr. Nama Lengkap',before:'/images/results/NAMA-before.jpg',after:'/images/results/NAMA-after.jpg',
        m:[{from:57,to:50,suf:' kg',u:'mKg',d:'dKg',k:1},{from:28,to:19,suf:'%',u:'mFat',d:'dPt'},{from:3,to:1.5,u:'mVfa2',d:'dLv'}],
        quote:{id:'Cerita dalam bahasa Indonesia',en:'The same story in English'}}

   Penurunan dihitung otomatis dari angka awal dan akhir. Kalau cuma tahu penurunannya, pakai `{drop:7,u:'mKg',d:'dKg',k:1}`.
   `coach:` boleh dihapus untuk coach yang belum punya link sendiri. Total di atas carousel muncul otomatis kalau ada 3 coach atau lebih.

3. **Link pribadi (opsional).** Di `assets/site.js`, salin blok `aj` di `COACHES`, ganti kodenya, isi nama, WhatsApp, kota,
   `palette` (`sky`, `rose`, atau `sage`), dan blok `transform` (angka utama + cerita). Tanpa blok `transform`, bagian "Cerita pertama" otomatis tersembunyi.
   Tanpa foto potret, foto sesudah coach itu yang dipakai.

4. **Warna baru (opsional).** Salin satu blok di `assets/palettes.css`, ganti namanya dan warnanya. Cek dengan `?palette=namanya` di ujung link.

5. **Build dan kirim.** `python3 scripts/build.py`, lalu commit dan push.

Link pribadi `#nama` juga membawa nama dan WhatsApp coach itu ke halaman test, kalori, dan tools.

## Link pendek per coach (untuk Threads / Instagram / TikTok)

Setiap coach di `assets/site.js` otomatis punya link `alvacy.com/<kode>` (contoh `alvacy.com/nova`).
Halaman-halamannya dibuat oleh `scripts/build.py`, jadi tidak perlu dibuat manual.

- `alvacy.com/nova` membuka tes umur badan, warna halaman mengikuti palet coach, dan lead masuk ke coach itu.
- `alvacy.com/nova?to=home` membuka halaman utama, `?to=hasil` membuka /transform.
- Tambah `?utm_source=threads` (atau instagram / tiktok) supaya sumbernya tercatat di Sheet.
- Selama pengunjung masih di alvacy.com, coach-nya terus terbawa (localStorage dan `#kode` di tautan antar halaman).

## Hasil coach (carousel)

Data hasil dan carouselnya ada di satu tempat: `assets/results.js` (blok `CASES`) dan `assets/results.css`.
Halaman utama dan /transform memakai modul yang sama. Urutan kartu acak tiap kunjungan, kartu coach yang mengundang tampil
pertama, dan auto-roll berhenti permanen begitu pengunjung menyentuh carousel.
