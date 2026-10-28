# Menambah coach baru

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
