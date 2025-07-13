import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

/**
 * 添加应用配置与AI模型配置的关联关系
 */
export class AddAIModelConfigRelation1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加aiModelConfigId列
    await queryRunner.addColumn(
      'app_config',
      new TableColumn({
        name: 'aiModelConfigId',
        type: 'int',
        isNullable: true,
      })
    );

    // 添加外键约束
    await queryRunner.createForeignKey(
      'app_config',
      new TableForeignKey({
        columnNames: ['aiModelConfigId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ai_model_config',
        onDelete: 'SET NULL', // 当AI模型配置被删除时，将引用设为NULL
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除外键约束
    const table = await queryRunner.getTable('app_config');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('aiModelConfigId') !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('app_config', foreignKey);
    }

    // 删除列
    await queryRunner.dropColumn('app_config', 'aiModelConfigId');
  }
} 