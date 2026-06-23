import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '../mockData/Direktori Karyawan.json');
  if (!fs.existsSync(filePath)) {
    console.error(`Mock data file not found at: ${filePath}`);
    return;
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const parsedData = JSON.parse(rawData);
  const employees = parsedData.direktori_karyawan.daftar_karyawan;

  console.log(`Seeding ${employees.length} employees...`);

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: {
        idKaryawan: emp.id_karyawan,
        namaLengkap: emp.nama_lengkap,
        jenisKelamin: emp.jenis_kelamin,
        tanggalLahir: emp.tanggal_lahir,
        jabatan: emp.jabatan,
        departemen: emp.departemen,
        level: emp.level,
        nomorTelepon: emp.nomor_telepon,
        tanggalBergabung: emp.tanggal_bergabung,
        lokasiKerja: emp.lokasi_kerja,
        status: emp.status,
        gajiPokok: emp.gaji_pokok,
        tunjangan: emp.tunjangan,
      },
      create: {
        idKaryawan: emp.id_karyawan,
        namaLengkap: emp.nama_lengkap,
        jenisKelamin: emp.jenis_kelamin,
        tanggalLahir: emp.tanggal_lahir,
        jabatan: emp.jabatan,
        departemen: emp.departemen,
        level: emp.level,
        email: emp.email,
        nomorTelepon: emp.nomor_telepon,
        tanggalBergabung: emp.tanggal_bergabung,
        lokasiKerja: emp.lokasi_kerja,
        status: emp.status,
        gajiPokok: emp.gaji_pokok,
        tunjangan: emp.tunjangan,
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
