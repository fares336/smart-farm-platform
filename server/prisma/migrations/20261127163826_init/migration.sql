-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('ROBOT', 'MANUAL', 'LAB');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('COMPLETED', 'UNAVAILABLE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "phone" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaHectares" DOUBLE PRECISION NOT NULL,
    "locationName" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "waterSource" TEXT,
    "soilTexture" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmBoundary" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "geojson" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmZone" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "polygon" JSONB NOT NULL,
    "centroidLat" DOUBLE PRECISION NOT NULL,
    "centroidLng" DOUBLE PRECISION NOT NULL,
    "areaM2" DOUBLE PRECISION NOT NULL,
    "cropKey" TEXT,
    "growthStage" TEXT,

    CONSTRAINT "FarmZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobotDevice" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceUid" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastDataAt" TIMESTAMP(3),
    "currentZoneId" TEXT,
    "batteryPct" DOUBLE PRECISION,
    "firmwareVersion" TEXT,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RobotDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilMeasurement" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "deviceId" TEXT,
    "source" "MeasurementSource" NOT NULL,
    "moisture" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "ec" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "nitrogenPpm" DOUBLE PRECISION,
    "phosphorusPpm" DOUBLE PRECISION,
    "potassiumPpm" DOUBLE PRECISION,
    "organicMatterPct" DOUBLE PRECISION,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "messageId" TEXT,
    "dedupeKey" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SoilMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "t2m" DOUBLE PRECISION,
    "t2mMax" DOUBLE PRECISION,
    "t2mMin" DOUBLE PRECISION,
    "rh2m" DOUBLE PRECISION,
    "precipMm" DOUBLE PRECISION,
    "solarMjM2" DOUBLE PRECISION,
    "windMs" DOUBLE PRECISION,
    "et0Mm" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'NASA POWER',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "phMin" DOUBLE PRECISION NOT NULL,
    "phOptMin" DOUBLE PRECISION NOT NULL,
    "phOptMax" DOUBLE PRECISION NOT NULL,
    "phMax" DOUBLE PRECISION NOT NULL,
    "tempMin" DOUBLE PRECISION NOT NULL,
    "tempOptMin" DOUBLE PRECISION NOT NULL,
    "tempOptMax" DOUBLE PRECISION NOT NULL,
    "tempMax" DOUBLE PRECISION NOT NULL,
    "moistureMin" DOUBLE PRECISION NOT NULL,
    "moistureOptMin" DOUBLE PRECISION NOT NULL,
    "moistureOptMax" DOUBLE PRECISION NOT NULL,
    "ecThreshold" DOUBLE PRECISION NOT NULL,
    "ecSlope" DOUBLE PRECISION NOT NULL,
    "kcIni" DOUBLE PRECISION NOT NULL,
    "kcMid" DOUBLE PRECISION NOT NULL,
    "kcEnd" DOUBLE PRECISION NOT NULL,
    "waterNeedMm" TEXT NOT NULL,
    "seasonEn" TEXT,
    "seasonAr" TEXT,
    "references" TEXT NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropRecommendation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT,
    "zoneId" TEXT,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "cropKey" TEXT,
    "growthStage" TEXT,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseReport" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "results" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiseaseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutrientAnalysis" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "results" JSONB,
    "context" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutrientAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FertilizerRecommendation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "zoneId" TEXT,
    "cropKey" TEXT NOT NULL,
    "growthStage" TEXT,
    "inputs" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FertilizerRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "zoneId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "volumeM3" DOUBLE PRECISION NOT NULL,
    "durationMin" DOUBLE PRECISION,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrrigationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BioPodExperiment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "conditions" TEXT,
    "startDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BioPodExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BioPodGroup" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "treatment" TEXT,
    "isControl" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BioPodGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BioPodObservation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "replicate" INTEGER NOT NULL,
    "day" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "waterAppliedMl" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BioPodObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSeason" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cropKey" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "farmId" TEXT,
    "itemKey" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceEgp" DOUBLE PRECISION NOT NULL,
    "isEstimate" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "priceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amountEgp" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestRecord" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "cropKey" TEXT NOT NULL,
    "quantityTon" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HarvestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "cropKey" TEXT NOT NULL,
    "quantityTon" DOUBLE PRECISION NOT NULL,
    "pricePerTonEgp" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "buyer" TEXT,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionReport" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "zoneId" TEXT,
    "content" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Farm_userId_idx" ON "Farm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmBoundary_farmId_key" ON "FarmBoundary"("farmId");

-- CreateIndex
CREATE INDEX "FarmZone_farmId_idx" ON "FarmZone"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmZone_farmId_code_key" ON "FarmZone"("farmId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RobotDevice_deviceUid_key" ON "RobotDevice"("deviceUid");

-- CreateIndex
CREATE INDEX "RobotDevice_farmId_idx" ON "RobotDevice"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "SoilMeasurement_dedupeKey_key" ON "SoilMeasurement"("dedupeKey");

-- CreateIndex
CREATE INDEX "SoilMeasurement_farmId_measuredAt_idx" ON "SoilMeasurement"("farmId", "measuredAt");

-- CreateIndex
CREATE INDEX "SoilMeasurement_zoneId_measuredAt_idx" ON "SoilMeasurement"("zoneId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherRecord_farmId_date_key" ON "WeatherRecord"("farmId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_key_key" ON "Crop"("key");

-- CreateIndex
CREATE INDEX "CropRecommendation_zoneId_generatedAt_idx" ON "CropRecommendation"("zoneId", "generatedAt");

-- CreateIndex
CREATE INDEX "PlantImage_userId_idx" ON "PlantImage"("userId");

-- CreateIndex
CREATE INDEX "IrrigationRecord_farmId_date_idx" ON "IrrigationRecord"("farmId", "date");

-- CreateIndex
CREATE INDEX "MarketPrice_farmId_idx" ON "MarketPrice"("farmId");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmBoundary" ADD CONSTRAINT "FarmBoundary_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmZone" ADD CONSTRAINT "FarmZone_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotDevice" ADD CONSTRAINT "RobotDevice_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotDevice" ADD CONSTRAINT "RobotDevice_currentZoneId_fkey" FOREIGN KEY ("currentZoneId") REFERENCES "FarmZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilMeasurement" ADD CONSTRAINT "SoilMeasurement_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilMeasurement" ADD CONSTRAINT "SoilMeasurement_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FarmZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilMeasurement" ADD CONSTRAINT "SoilMeasurement_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "RobotDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherRecord" ADD CONSTRAINT "WeatherRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropRecommendation" ADD CONSTRAINT "CropRecommendation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropRecommendation" ADD CONSTRAINT "CropRecommendation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FarmZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantImage" ADD CONSTRAINT "PlantImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantImage" ADD CONSTRAINT "PlantImage_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantImage" ADD CONSTRAINT "PlantImage_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FarmZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseReport" ADD CONSTRAINT "DiseaseReport_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "PlantImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutrientAnalysis" ADD CONSTRAINT "NutrientAnalysis_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "PlantImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertilizerRecommendation" ADD CONSTRAINT "FertilizerRecommendation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertilizerRecommendation" ADD CONSTRAINT "FertilizerRecommendation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FarmZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationRecord" ADD CONSTRAINT "IrrigationRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationRecord" ADD CONSTRAINT "IrrigationRecord_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FarmZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioPodExperiment" ADD CONSTRAINT "BioPodExperiment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioPodExperiment" ADD CONSTRAINT "BioPodExperiment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioPodGroup" ADD CONSTRAINT "BioPodGroup_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "BioPodExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioPodObservation" ADD CONSTRAINT "BioPodObservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BioPodGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialSeason" ADD CONSTRAINT "FinancialSeason_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "FinancialSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestRecord" ADD CONSTRAINT "HarvestRecord_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "FinancialSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "FinancialSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionReport" ADD CONSTRAINT "DecisionReport_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionReport" ADD CONSTRAINT "DecisionReport_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FarmZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
